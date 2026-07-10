# Aura 主题开发文档

> 本文档由 AI 生成，作者很懒，不想自己写。  
> 内容已根据 Aura 源码实际行为验证和补充。

---

Aura 将**主题（Theme）**定义为站点的表现层。一个主题本质上是一组布局函数、视图函数和样式资产的集合，它们共同决定了站点的视觉呈现和用户体验。

### 通用性设计原则

Aura 的主题生态强调**通用性**，即同一个主题应能服务于博客、文档站、企业官网、作品集等多种站点类型。为实现这一目标，主题开发者必须遵循以下核心原则：

1. **数据源抽象**：主题绝不硬编码特定插件或数据命名空间。所有数据引用必须通过配置项（`themeOptions.bindings`）动态解析。
2. **表现与内容分离**：主题只负责“如何显示”，不关心“数据从何而来”。数据由插件提供，主题通过 `view` 标识符和 `binding` 指针获取。
3. **渐进式降级**：当数据缺失、视图不支持或样式类名缺失时，模板必须能优雅地显示占位内容或空状态，保证页面可访问性。
4. **配置驱动的可变性**：页面结构（布局）、内容映射（插槽）均应由 `themeOptions` 控制，而非写死在代码中。

---

## 2. 环境与路径解析

框架根目录的 `package.json` 默认配置如下：

```json
{
  "name": "aura-framework",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "aura": "./dist/cli.js"
  },
  "scripts": {
    "dev": "tsx src/cli.ts build --root ./playground",
    "build:core": "tsc"
  },
  "devDependencies": {
    "tsx": "^4.7.0",
    "typescript": "^5.4.0",
    "@types/node": "^20.11.0"
  }
}
```

**路径解析逻辑**（参考 `config.ts` 与 `pipeline.ts`）：

- 命令行参数 `--root <path>` 指定项目根目录，默认回退到 `process.cwd()`。
- 配置文件 `aura.config.ts` 从根目录加载。
- 主题目录解析为：`${root}/srcDir/themes/${theme}`。
  - `srcDir` 默认值为 `'.'`（即根目录），但可在 `aura.config.ts` 中通过 `srcDir` 重写。
  - 在默认的 `dev` 脚本中，`root` 为 `./playground`，因此主题路径为 `./playground/themes/<theme-name>/`。
- **重要**：若你自定义 `srcDir`（如 `srcDir: './src'`），则主题路径变为 `./src/themes/<theme-name>/`。

---

## 3. 主题目录结构规范

一个功能完整的主题目录应遵循以下结构（推荐规范）：

```
playground/themes/my-theme/
├── layouts/                  # [必须] 布局入口目录
│   ├── single.ts             # 单栏布局
│   ├── two-col-left.ts       # 双栏左侧布局
│   └── three-col.ts          # 三栏布局
├── views/                    # [必须] 视图渲染函数目录
│   ├── tree-nav.ts           # 树状导航视图
│   ├── toc.ts                # 目录视图
│   ├── list.ts               # 列表视图（降级备用）
│   └── breadcrumbs.ts        # 面包屑视图
├── styles.css                # [必须] 全局样式（包含契约要求的 CSS 变量和原子类）
├── assets/                   # [可选] 主题私有资源（图片、字体等）
│   ├── logo.svg
│   └── fonts/
├── public/                   # [可选] 构建时直接复制到输出目录的静态文件
│   ├── favicon.ico
│   └── robots.txt
├── types.ts                  # [可选] TypeScript 类型定义
└── README.md                 # [推荐] 使用文档（支持的 view 标识符说明）
```

**目录职能说明**：

| 目录/文件 | 职能 |
|-----------|------|
| `layouts/` | 存放布局函数，文件名对应 `themeOptions.layouts` 中的标识符。负责页面骨架和插槽组装。 |
| `views/` | 存放视图渲染函数，文件名对应 `themeOptions.slots` 中的 `view` 标识符。负责具体业务内容的 HTML 生成。 |
| `styles.css` | 全局样式表，以 `<style>` 内联方式注入所有页面 `<head>`。**必须包含契约规定的 CSS 变量和 `.aura-ui-*` 类名。** |
| `assets/` | 存放 CSS/JS 引用的图片、字体等，主题内部通过相对路径引用。 |
| `public/` | 存放无需加工、直接复制到 `outDir` 根目录的文件。 |

---

## 4. 核心类型与接口

在开始编码之前，必须熟悉 Aura 暴露给主题的核心类型。这些类型定义在 `context.ts` 中。

### 4.1 AuraContext

```typescript
interface AuraContext {
  config: ResolvedConfig;          // 最终解析的全量配置
  collections: Collection[];       // 所有内容集合
  routes: Route[];                // 所有路由（构建时已解析）
  data: DataStore;               // 数据存储实例
  assets: AssetManager;          // 资产管理实例
  components: Map<string, Function>; // 全局组件注册表（插件可注入）
  viewRegistry: Map<string, Function>; // 视图注册表（插件可注册自定义视图）
}
```

### 4.2 ResolvedConfig（关键子集）

```typescript
interface ResolvedConfig extends UserConfig {
  root: string;          // 项目根目录绝对路径
  outDir: string;        // 输出目录绝对路径（默认 dist）
  srcDir: string;        // 源目录绝对路径（默认 root）
  theme: string;         // 当前激活的主题名称
  site: SiteConfig;      // 站点元信息
  themeOptions?: any;    // [自定义] 主题配置项（核心扩展点）
  routes: RouteBlueprint[]; // 路由蓝图
  plugins: string[];     // 启用的插件列表
}
```

其中 `SiteConfig` 定义：

```typescript
interface SiteConfig {
  title: string;
  description?: string;
}
```

### 4.3 Route（路由对象）

```typescript
interface Route {
  path: string;                    // URL 路径
  pageType: string;                // 页面类型标识符，用于匹配布局
  collection?: string;            // 关联的集合名称（若有）
  data: Record<string, any>;      // 该路由特有的数据（由插件或解析器填充）
}
```

**注意**：`template` 和 `modules` 字段已从 Route 接口中移除。

### 4.4 Collection 与 CollectionItem

```typescript
interface Collection {
  name: string;
  items: CollectionItem[];
}

interface CollectionItem {
  id: string;
  slug: string;
  collection: string;             // 所属集合名
  metadata: Record<string, any>;  // 元数据（标题、日期、标签等）
  content: string;               // 主体内容（通常是 Markdown 或 HTML）
}
```

---

## 5. 布局引擎（Layouts）深度解析

### 5.1 函数签名与参数

布局文件位于 `layouts/` 目录下，必须默认导出一个函数，其签名如下：

```typescript
type LayoutFunction = (
  ctx: AuraContext,
  slotsHtml: Record<string, string>, // 已渲染好的插槽 HTML 集合
  route: Route
) => string | Promise<string>;
```

- **`ctx`**：完整上下文，可访问所有配置、数据、集合。
- **`slotsHtml`**：由渲染引擎根据 `themeOptions.slots` 配置预先渲染好的各插槽 HTML 字符串集合。键为插槽名（如 `'header'`, `'aside-start'`）。
- **`route`**：当前正在渲染的路由对象。

### 5.2 布局的核心职责

布局应完成以下任务：
1. 输出 `<!DOCTYPE html>` 及 `<html>` 根元素。
2. 在 `<head>` 中设置字符集、视口、标题、描述等元标签。
3. 根据 `slotsHtml` 中的内容，将其放置在正确的 DOM 位置（如 `<header>`, `<aside>`, `<main>`）。
4. **不要**在布局中手动引入 `<style>` 或 `<script>` 来加载插件资源——Aura 的渲染器（`renderer.ts`）会在 `</head>` 前和 `</body>` 前自动注入。

### 5.3 高级布局技巧

**动态标题生成**：

```typescript
// layouts/single.ts
export default function layout(ctx, slotsHtml, route) {
  const siteTitle = ctx.config.site?.title || 'Untitled';
  const pageTitle = route.data?.title || route.pageType || 'Page';
  const title = route.path === '/' ? siteTitle : `${pageTitle} - ${siteTitle}`;
  
  const headerHtml = slotsHtml['header'] || '';
  const footerHtml = slotsHtml['footer'] || '';
  const contentBefore = slotsHtml['content-before'] || '';
  const mainContent = slotsHtml['main'] || ''; // 假设主内容插槽名为 'main'
  const contentAfter = slotsHtml['content-after'] || '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</meta>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
  ${headerHtml}
  <main>
    ${contentBefore}
    ${mainContent}
    ${contentAfter}
  </main>
  ${footerHtml}
</body>
</html>`;
}
```

**多栏布局示例**：

```typescript
// layouts/two-col-left.ts
export default function layout(ctx, slotsHtml, route) {
  const asideStart = slotsHtml['aside-start'] || '';
  const contentBefore = slotsHtml['content-before'] || '';
  const mainContent = slotsHtml['main'] || '';
  const contentAfter = slotsHtml['content-after'] || '';

  return `<!DOCTYPE html>
<html>
<head>...</head>
<body>
  <div class="c-layout-two-col-left">
    <aside class="c-aside-start">${asideStart}</aside>
    <main>
      ${contentBefore}
      ${mainContent}
      ${contentAfter}
    </main>
  </div>
</body>
</html>`;
}
```

---

## 6. 视图函数（Views）深度解析

### 6.1 函数签名与参数

视图文件位于 `views/` 目录下，必须默认导出一个函数：

```typescript
type ViewFunction = (
  data: any,                 // 从 binding 或 source 解析出的具体数据
  ctx: AuraContext,          // 完整上下文
  props: Record<string, any> // 插槽配置中的 props
) => string | Promise<string>;
```

**关键区别**：
- `data` 参数不再是扁平化的 `DataStore`，而是经过 `bindings` 或 `source` 解析后的**具体业务数据**。
- `props` 允许用户在 `themeOptions.slots` 中传递自定义配置（如 `collapsible: true`）。

### 6.2 视图数据获取模式

视图函数接收的数据已经由渲染引擎预处理过：

```typescript
// views/tree-nav.ts
export default function renderTreeNav(data, ctx, props) {
  // data 已经是 StandardNavItem[] 或其他绑定数据
  if (!Array.isArray(data) || data.length === 0) {
    return ''; // 降级：无数据时返回空
  }
  
  const depth = props.depth || 99;
  return `<nav class="c-tree-nav">
    ${renderNodes(data, 0, depth)}
  </nav>`;
}

function renderNodes(nodes, currentDepth, maxDepth) {
  if (currentDepth >= maxDepth) return '';
  return `<ul>${nodes.map(node => `
    <li>
      <a href="${node.url || '#'}">${node.title}</a>
      ${node.children ? renderNodes(node.children, currentDepth + 1, maxDepth) : ''}
    </li>
  `).join('')}</ul>`;
}
```

### 6.3 错误处理与降级

始终为数据缺失提供降级方案：

```typescript
export default function renderList(data, ctx, props) {
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return `<div class="aura-ui-typography-body">No items available.</div>`;
  }
  // ... 正常渲染
}
```

---

## 7. 数据流与数据访问模式

理解 Aura 构建时的数据流水线对于主题开发至关重要。

**数据流水线顺序**（参考 `pipeline.ts`）：

1. **`loadContent`** 钩子：插件加载初始集合（`Collection[]`）。
2. **`transformCollections`** 钩子：插件转换/过滤集合。
3. **`fetchData`** 钩子：插件将任意数据写入 `DataStore`。
4. **路由解析**（`resolveRoutes`）：生成路由列表。
5. **`generateRoutes`** 钩子：插件修改路由（可在此为 `route.data` 附加数据）。
6. **渲染阶段**：
  - 渲染引擎读取 `themeOptions.bindings` 和 `themeOptions.slots`。
  - 根据 `binding` 从 `ctx.data.getFlat()` 提取数据。
  - 根据 `source` 从 `route.data` 提取数据。
  - 调用对应的 `view` 函数生成 HTML。
  - 调用 `layout` 函数组装最终页面。

**主题可用的数据来源**：

| 来源 | 访问方式 | 适用场景 |
|------|----------|----------|
| 站点配置 | `ctx.config.site` | 站点标题、描述、URL 等 |
| 主题配置 | `ctx.config.themeOptions` | 导航、布局开关、数据映射配置 |
| 数据存储 | `ctx.data.getFlat()` | 插件提供的业务数据（通过 `bindings` 间接访问） |
| 集合 | `ctx.collections` | 需要遍历或按 slug 查找的内容集合 |
| 路由数据 | `route.data` | 当前页面特有的数据（通过 `source` 间接访问） |

---

## 8. 配置驱动的通用性设计模式

这是实现主题复用的核心章节。

### 8.1 定义主题配置接口

在主题的 `README.md` 中明确定义支持的 `themeOptions` 结构，例如：

```typescript
interface MyThemeOptions {
  // 布局预设
  layouts: {
    home?: string;      // 首页布局标识符
    doc?: string;       // 文档页布局标识符
    default?: string;   // 默认布局标识符
  };
  
  // 数据源指针
  bindings: {
    sidebar?: { source: 'datastore', target: 'docs:tree' };
    comments?: { source: 'datastore', target: 'comments:list' };
  };
  
  // 插槽视图
  slots: {
    'header': { view: 'site-header', props: { showLogo: true } };
    'aside-start': { view: 'tree-nav', binding: 'sidebar' };
    'content-after': { view: 'comments', binding: 'comments' };
  };
}
```

### 8.2 在视图中解析 Props

编写可复用的视图助手：

```typescript
// views/list.ts
export default function renderList(data, ctx, props) {
  const items = Array.isArray(data) ? data : [];
  const showImage = props.showImage !== false;
  const showExcerpt = props.showExcerpt || false;

  return `
    <div class="c-list">
      ${items.map(item => `
        <article class="aura-ui-card">
          ${showImage && item.coverImage ? `<img class="aura-ui-avatar" src="${item.coverImage}" />` : ''}
          <h3 class="aura-ui-typography-h3"><a href="${item.url || item.slug}">${item.title}</a></h3>
          ${showExcerpt && item.excerpt ? `<p class="aura-ui-typography-body">${item.excerpt}</p>` : ''}
        </article>
      `).join('')}
    </div>
  `;
}
```

### 8.3 条件渲染示例

```typescript
// views/breadcrumbs.ts
export default function renderBreadcrumbs(data, ctx, props) {
  if (!Array.isArray(data) || data.length === 0) return '';
  
  return `
    <nav class="c-breadcrumbs">
      ${data.map((crumb, index) => `
        <span class="aura-ui-typography-body">
          ${index < data.length - 1 
            ? `<a href="${crumb.url}">${crumb.title}</a> / ` 
            : crumb.title}
        </span>
      `).join('')}
    </nav>
  `;
}
```

---

## 9. 视图组合与代码复用

避免在多个视图中重复代码。利用辅助函数抽取公共片段。

### 9.1 创建可复用片段

`views/utils.ts`：

```typescript
export function renderAvatar(url: string, alt: string) {
  return `<img class="aura-ui-avatar" src="${url}" alt="${alt}" />`;
}

export function renderBadge(text: string) {
  return `<span class="aura-ui-badge">${text}</span>`;
}
```

### 9.2 在视图中导入使用

```typescript
// views/post-card.ts
import { renderAvatar, renderBadge } from './utils.js';

export default function renderPostCard(data, ctx, props) {
  return `
    <div class="aura-ui-card">
      ${data.author ? renderAvatar(data.author.avatar, data.author.name) : ''}
      <h3 class="aura-ui-typography-h3">${data.title}</h3>
      ${data.tags ? data.tags.map(t => renderBadge(t)).join(' ') : ''}
    </div>
  `;
}
```

**注意**：由于 Aura 使用 `import()` 动态加载视图，请确保导入路径使用相对路径并包含 `.js` 扩展名。

---

## 10. 集合（Collections）的遍历与应用

集合（`Collection`）是内容组织的核心结构。主题可以通过 `ctx.collections` 访问所有集合。

### 10.1 获取特定集合

```typescript
function getCollectionByName(ctx: AuraContext, name: string): Collection | undefined {
  return ctx.collections.find(c => c.name === name);
}
```

### 10.2 聚合标签云示例

```typescript
// views/tag-cloud.ts
export default function renderTagCloud(data, ctx, props) {
  // 假设 data 是通过 binding 传入的集合名称字符串
  const collectionName = typeof data === 'string' ? data : 'posts';
  const coll = ctx.collections.find(c => c.name === collectionName);
  if (!coll) return '<p class="aura-ui-typography-body">No tags</p>';

  const tagCount: Record<string, number> = {};
  for (const item of coll.items) {
    const tags = item.metadata?.tags || [];
    for (const tag of tags) {
      tagCount[tag] = (tagCount[tag] || 0) + 1;
    }
  }

  const sorted = Object.entries(tagCount).sort((a, b) => b[1] - a[1]);
  const limit = props.limit || 30;
  const limited = sorted.slice(0, limit);

  return `
    <div class="c-tag-cloud">
      ${limited.map(([tag, count]) => `<span class="aura-ui-badge">${tag} (${count})</span>`).join(' ')}
    </div>
  `;
}
```

---

## 11. 动态路由与数据映射

动态路由（如 `/posts/:slug`）需要视图能够根据路径参数查找对应的内容项。

### 11.1 路由数据填充

动态路由的数据通常在插件的 `generateRoutes` 钩子中填充 `route.data`。主题开发者应假设 `route.data` 已包含当前页面所需的对象。

### 11.2 详情视图实现

```typescript
// views/post-detail.ts
export default function renderPostDetail(data, ctx, props) {
  // 假定插件已填充 route.data.item，并通过 source: 'item' 传入
  const item = data; 
  if (!item) {
    return `<div class="aura-ui-typography-body">内容未找到</div>`;
  }

  // 从 props 读取元数据显示开关
  const showDate = props.showDate !== false;
  const showAuthor = props.showAuthor || false;

  return `
    <article class="aura-ui-card">
      <h1 class="aura-ui-typography-h1">${item.title || '无标题'}</h1>
      ${showDate && item.date ? `<div class="meta"><time class="aura-ui-typography-body">${new Date(item.date).toLocaleDateString()}</time></div>` : ''}
      ${showAuthor && item.author ? `<div class="author aura-ui-typography-body">作者：${item.author}</div>` : ''}
      <div class="content aura-ui-typography-body">${item.content || ''}</div>
    </article>
  `;
}
```

---

## 12. 静态资源与资产管理

### 12.1 主题私有资源（`assets/`）

在 CSS 中引用主题私有资源：

```css
/* styles.css */
.logo {
  background-image: url('./assets/logo.svg');
}
```

Aura 不会主动处理 `assets/` 目录，资源引用路径相对于输出文件。由于 CSS 被内联注入 `<head>`，`url()` 相对于页面路径解析可能失败。**推荐做法**：将公共静态资源放在 `public/` 目录，并直接引用绝对路径（如 `/logo.svg`）。

### 12.2 公共静态资源（`public/`）

构建时，`pipeline.ts` 会执行 `cp(publicDir, outDir, { recursive: true })`，将 `public/` 下所有内容复制到输出目录根路径。因此，`public/favicon.ico` 可通过 `/favicon.ico` 访问。

---

## 13. TypeScript 开发指南

为提升开发体验，为主题编写类型定义。

### 13.1 定义主题配置类型

在主题根目录创建 `types.ts`：

```typescript
// types.ts
export interface MyThemeOptions {
  layouts?: Record<string, string>;
  bindings?: Record<string, { source: string; target: string }>;
  slots?: Record<string, { view: string; binding?: string; source?: string; props?: any }>;
}
```

### 13.2 扩展 Aura 全局类型

在主题目录下创建 `ambient.d.ts` 以扩展 `ResolvedConfig`：

```typescript
// ambient.d.ts
import { MyThemeOptions } from './types.js';

declare module '../core/context.js' {
  interface ResolvedConfig {
    themeOptions?: MyThemeOptions;
  }
}
```

**注意**：因 Aura 使用动态导入，类型扩展仅用于开发时的智能提示，不影响运行时行为。

### 13.3 带类型的视图写法

```typescript
// views/tree-nav.ts
import type { AuraContext } from '../../../src/core/context.js';
import type { StandardNavItem } from '../../../CONTRACT.zh.md'; // 假设引用契约类型

interface TreeNavProps {
  collapsible?: boolean;
  depth?: number;
}

export default function renderTreeNav(
  data: StandardNavItem[],
  ctx: AuraContext,
  props: TreeNavProps
): string {
  // ... 类型安全的编码
}
```

---

## 14. 调试与诊断技术

### 14.1 日志输出

视图或布局中可使用 `console.log` 输出调试信息：

```typescript
export default function render(data, ctx, props) {
  console.log('[Theme Debug] View Data:', data);
  console.log('[Theme Debug] Props:', props);
  // ...
}
```

构建时，所有日志将输出到终端。

### 14.2 数据快照

若需查看传入视图的完整数据，可在视图中临时输出 JSON（记得在生产前移除）：

```typescript
// 危险操作：会破坏页面，仅用于调试
return `<pre>${JSON.stringify({ data, props }, null, 2)}</pre>`;
```

### 14.3 常见错误排查

| 错误现象 | 可能原因 | 解决方案 |
|----------|----------|----------|
| `Cannot find module` | 视图/布局导入路径错误 | 使用相对路径并确认文件扩展名（`.ts` 或 `.js`） |
| 页面空白 | 布局/视图函数未返回字符串 | 确保默认导出返回 `string` |
| 样式未生效 | `styles.css` 缺失契约变量或类名 | 运行构建，检查 `[Aura] Theme styles validation failed` 错误 |
| 数据为空 | `bindings` 配置的 `target` 与插件不匹配 | 打印 `ctx.data.getFlat()` 检查实际结构 |
| 视图未找到 | `views/` 下缺少对应文件且无 `list.ts` 降级 | 创建 `views/list.ts` 作为通用降级视图 |

---

## 15. 完整主题示例

以下是一个极简但符合通用性原则的主题 `barebone`。

**目录结构**：

```
playground/themes/barebone/
├── layouts/
│   └── single.ts
├── views/
│   ├── list.ts
│   └── site-header.ts
├── styles.css
└── README.md
```

**`styles.css`**：

```css
:root {
  --aura-color-primary: #007bff;
  --aura-color-text: #213547;
  --aura-color-border: #e2e8f0;
  --aura-font-sans: system-ui, sans-serif;
  --aura-space-md: 1rem;
  --aura-radius-md: 8px;
}

.aura-ui-btn {
  background: var(--aura-color-primary);
  color: white;
  border-radius: var(--aura-radius-md);
  padding: 0.5rem 1rem;
}

.aura-ui-card {
  border: 1px solid var(--aura-color-border);
  border-radius: var(--aura-radius-md);
  padding: var(--aura-space-md);
}

.aura-ui-typography-h1 {
  font-size: 2rem;
  font-weight: bold;
}

.aura-ui-typography-body {
  font-size: 1rem;
  line-height: 1.5;
}
```

**`layouts/single.ts`**：

```typescript
export default function layout(ctx, slotsHtml, route) {
  const siteTitle = ctx.config.site?.title || 'Barebone';
  const title = route.path === '/' ? siteTitle : `${route.pageType} - ${siteTitle}`;
  
  const headerHtml = slotsHtml['header'] || '';
  const contentBefore = slotsHtml['content-before'] || '';
  const mainContent = slotsHtml['main'] || '';
  const contentAfter = slotsHtml['content-after'] || '';
  const footerHtml = slotsHtml['footer'] || '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
  ${headerHtml}
  <main>
    ${contentBefore}
    ${mainContent}
    ${contentAfter}
  </main>
  ${footerHtml}
</body>
</html>`;
}
```

**`views/site-header.ts`**：

```typescript
export default function renderSiteHeader(data, ctx, props) {
  const nav = ctx.config.themeOptions?.nav || [];
  return `
    <header class="aura-ui-card">
      <h1 class="aura-ui-typography-h1"><a href="/">${ctx.config.site?.title}</a></h1>
      <nav>
        ${nav.map(n => `<a class="aura-ui-btn" href="${n.url}">${n.label}</a>`).join(' ')}
      </nav>
    </header>
  `;
}
```

**`views/list.ts`**：

```typescript
export default function renderList(data, ctx, props) {
  const items = Array.isArray(data) ? data : [];
  if (!items.length) return '<p class="aura-ui-typography-body">No content yet.</p>';
  
  return `
    <div class="c-list">
      ${items.map(item => `
        <div class="aura-ui-card">
          <h3 class="aura-ui-typography-h1"><a href="${item.url || item.slug}">${item.title}</a></h3>
        </div>
      `).join('')}
    </div>
  `;
}
```

用户配置示例：

```typescript
// aura.config.ts
export default {
  theme: 'barebone',
  plugins: ['blog'],
  themeOptions: {
    layouts: {
      default: 'single'
    },
    bindings: {
      blogPosts: { source: 'datastore', target: 'blog:posts' }
    },
    slots: {
      'header': { view: 'site-header' },
      'main': { view: 'list', binding: 'blogPosts' }
    },
    nav: [{ label: 'Home', url: '/' }]
  }
};
```