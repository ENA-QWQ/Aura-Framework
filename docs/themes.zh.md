# Aura 主题开发文档

> 本文档由 AI 生成，作者很懒，不想自己写。  
> 内容已根据 Aura 源码实际行为验证和补充。

---

Aura 将**主题（Theme）**定义为站点的表现层。一个主题本质上是一组模板函数和样式资产的集合，它们共同决定了站点的视觉呈现和用户体验。

### 通用性设计原则

Aura 的主题生态强调**通用性**，即同一个主题应能服务于博客、文档站、企业官网、作品集等多种站点类型。为实现这一目标，主题开发者必须遵循以下核心原则：

1. **数据源抽象**：主题绝不硬编码特定插件或数据命名空间。所有数据引用必须通过配置项（如 `themeOptions`）动态解析。
2. **表现与内容分离**：主题只负责“如何显示”，不关心“数据从何而来”。数据由插件或用户通过 `DataStore` 提供。
3. **渐进式降级**：当数据缺失或格式不符时，模板必须能优雅地显示占位内容或空状态，保证页面可访问性。
4. **配置驱动的可变性**：页面元素的显隐、排序、格式均应由配置控制，而非写死。

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
├── layout.ts               # [必须] 布局入口
├── styles.css              # [推荐] 全局样式（自动注入 <head>）
├── templates/              # [必须] 页面模板目录
│   ├── home.ts
│   ├── page.ts
│   ├── post.ts
│   └── archive.ts
├── partials/               # [推荐] 可复用组件/片段
│   ├── header.ts
│   ├── footer.ts
│   ├── sidebar.ts
│   └── card.ts
├── assets/                 # [可选] 主题私有资源（图片、字体等）
│   ├── logo.svg
│   └── fonts/
├── public/                 # [可选] 构建时直接复制到输出目录的静态文件
│   ├── favicon.ico
│   └── robots.txt
├── types.ts                # [可选] TypeScript 类型定义
└── README.md               # [推荐] 使用文档（配置项说明）
```

**目录职能说明**：

| 目录/文件 | 职能 |
|-----------|------|
| `layout.ts` | 定义页面外框（HTML 骨架），所有路由共用。 |
| `styles.css` | 全局样式表，以 `<style>` 内联方式注入所有页面 `<head>`。 |
| `templates/` | 存放具体页面的内容渲染函数，文件名对应路由的 `template` 字段。 |
| `partials/` | 存放可复用 UI 片段（函数），供布局或模板调用，避免重复代码。 |
| `assets/` | 存放 CSS/JS 引用的图片、字体等，主题内部通过相对路径引用（如 `url('./assets/logo.png')`）。 |
| `public/` | 存放无需加工、直接复制到 `outDir` 根目录的文件（如 `favicon.ico`）。 |

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
  // 用户可任意扩展其他字段
}
```

### 4.3 Route（路由对象）

```typescript
interface Route {
  path: string;                    // URL 路径
  template: string;                // 对应 templates/ 中的文件名
  modules: string[];              // 保留字段
  collection?: string;            // 关联的集合名称（若有）
  pageType?: string;              // 页面类型（'list' | 'detail' | 'page' 等）
  data: Record<string, any>;      // 该路由特有的数据（由插件或解析器填充）
}
```

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

## 5. 布局模板（Layout）深度解析

### 5.1 函数签名与参数

布局文件（`layout.ts`）必须默认导出一个函数，其签名如下：

```typescript
type LayoutFunction = (
  ctx: AuraContext,
  pageHtml: string,
  route: Route
) => string | Promise<string>;
```

- **`ctx`**：完整上下文，可访问所有配置、数据、集合。
- **`pageHtml`**：由页面模板生成的 HTML 内容（即 `<main>` 内部的内容）。
- **`route`**：当前正在渲染的路由对象。

### 5.2 布局的核心职责

布局应完成以下任务：
1. 输出 `<!DOCTYPE html>` 及 `<html>` 根元素。
2. 在 `<head>` 中设置字符集、视口、标题、描述等元标签。
3. 渲染公共导航、页眉、页脚。
4. 将 `pageHtml` 插入主内容区域。
5. **不要**在布局中手动引入 `<style>` 或 `<script>` 来加载插件资源——Aura 的渲染器（`renderer.ts`）会在 `</head>` 前和 `</body>` 前自动注入。

### 5.3 高级布局技巧

**动态标题生成**：

```typescript
// layout.ts
export default function layout(ctx, pageHtml, route) {
  const siteTitle = ctx.config.site?.title || 'Untitled';
  const pageTitle = route.data?.title || route.pageType || 'Page';
  const title = route.path === '/' ? siteTitle : `${pageTitle} - ${siteTitle}`;
  // ...
}
```

**主题配置驱动导航**：

```typescript
const nav = ctx.config.themeOptions?.nav || [];
// nav: [{ label: 'Home', url: '/' }, ...]
```

**条件性侧栏/布局**：

```typescript
const layoutType = route.data?.layout || ctx.config.themeOptions?.defaultLayout || 'full';
// 根据 layoutType 决定是否渲染侧栏
```

---

## 6. 页面模板（Templates）深度解析

### 6.1 函数签名与参数

页面模板位于 `templates/` 目录下，必须默认导出一个函数：

```typescript
type TemplateFunction = (
  ctx: AuraContext,
  route: Route,
  data: Record<string, any>   // 注意：这是 ctx.data.getFlat() 的结果
) => string | Promise<string>;
```

**关键区别**：
- `data` 参数是 `DataStore` 所有命名空间的**扁平化快照**，结构为 `{ [namespace: string]: { [key: string]: any } }`。
- 若你需要访问集合（`collections`），必须通过 `ctx.collections` 直接获取，它**不在** `data` 对象中。

### 6.2 模板数据获取模式

由于 `data` 是扁平命名空间，访问数据时应采用以下模式：

```typescript
// 坏实践：硬编码插件名
const posts = data['my-blog-plugin']?.posts;

// 好实践：通过配置解析命名空间
const ns = ctx.config.themeOptions?.blog?.namespace || 'blog';
const key = ctx.config.themeOptions?.blog?.key || 'posts';
const items = data[ns]?.[key] || [];
```

### 6.3 错误处理与占位

始终为数据缺失提供降级方案：

```typescript
export default function(ctx, route, data) {
  const items = resolveData(ctx, data); // 自定义解析函数
  if (!items || items.length === 0) {
    return `<div class="empty-state">${ctx.config.themeOptions?.emptyMessage || 'No content available.'}</div>`;
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
6. **渲染阶段**：主题模板执行，访问 `ctx` 和 `data`。

**主题可用的数据来源**：

| 来源 | 访问方式 | 适用场景 |
|------|----------|----------|
| 站点配置 | `ctx.config.site` | 站点标题、描述、URL 等 |
| 主题配置 | `ctx.config.themeOptions` | 导航、布局开关、数据映射配置 |
| 数据存储 | `data`（即 `ctx.data.getFlat()`） | 插件提供的业务数据（文章、产品、文档等） |
| 集合 | `ctx.collections` | 需要遍历或按 slug 查找的内容集合 |
| 路由数据 | `route.data` | 当前页面特有的数据（如动态路由参数对应的详情） |

---

## 8. 配置驱动的通用性设计模式

这是实现主题复用的核心章节。

### 8.1 定义主题配置接口

在主题的 `README.md` 中明确定义支持的 `themeOptions` 结构，例如：

```typescript
interface MyThemeOptions {
  // 导航配置
  nav: Array<{ label: string; url: string }>;
  // 博客模块配置
  blog: {
    namespace: string;      // 数据命名空间
    key: string;           // 数据键名
    slugField: string;     // slug 字段名
    dateFormat: string;    // 日期格式
    showAuthor: boolean;
  };
  // 侧栏配置
  sidebar: {
    enabled: boolean;
    position: 'left' | 'right';
    widgets: string[];     // 组件列表
  };
  // 布局预设
  defaultLayout: 'full' | 'sidebar';
  // 空状态文案
  emptyMessage: string;
}
```

### 8.2 在模板中解析配置

编写一个可复用的解析助手（推荐放在 `partials/utils.ts`）：

```typescript
// partials/utils.ts
export function resolveCollectionData(ctx: AuraContext, data: Record<string, any>, configKey: string) {
  const opts = ctx.config.themeOptions?.[configKey] || {};
  const ns = opts.namespace || 'content';
  const key = opts.key || 'items';
  return data[ns]?.[key] || [];
}
```

### 8.3 条件渲染示例

```typescript
// templates/archive.ts
export default function(ctx, route, data) {
  const opts = ctx.config.themeOptions?.archive || {};
  const showDate = opts.showDate !== false; // 默认显示
  const showTags = opts.showTags || false;
  const items = data[opts.namespace || 'blog']?.[opts.key || 'posts'] || [];

  return `
    <div class="archive">
      ${items.map(item => `
        <article>
          <h2><a href="${item.slug}">${item.title}</a></h2>
          ${showDate && item.date ? `<time>${new Date(item.date).toLocaleDateString()}</time>` : ''}
          ${showTags && item.tags ? `<div class="tags">${item.tags.join(', ')}</div>` : ''}
        </article>
      `).join('')}
    </div>
  `;
}
```

---

## 9. 模板组合与代码复用

避免在多个模板中重复代码。利用 `partials/` 目录抽取公共片段。

### 9.1 创建可复用片段

`partials/card.ts`：

```typescript
export function renderCard(item: any, opts: { showImage?: boolean; showExcerpt?: boolean }) {
  return `
    <div class="card">
      ${opts.showImage && item.image ? `<img src="${item.image}" alt="${item.title}">` : ''}
      <h3><a href="${item.url || item.slug}">${item.title || 'Untitled'}</a></h3>
      ${opts.showExcerpt && item.excerpt ? `<p>${item.excerpt}</p>` : ''}
    </div>
  `;
}
```

### 9.2 在模板中导入使用

```typescript
// templates/home.ts
import { renderCard } from '../partials/card.js';

export default function(ctx, route, data) {
  const opts = ctx.config.themeOptions?.home || {};
  const items = data[opts.namespace || 'blog']?.[opts.key || 'posts'] || [];
  return `
    <section class="home-grid">
      ${items.map(item => renderCard(item, { showImage: true, showExcerpt: true })).join('')}
    </section>
  `;
}
```

**注意**：由于 Aura 使用 `import()` 动态加载模板，请确保导入路径使用相对路径并包含 `.js` 扩展名（即使源码是 `.ts`，编译后为 `.js`，Aura 运行时加载的是编译后的文件，但若使用 `tsx` 运行则能直接解析 `.ts`。为稳妥起见，建议在主题中直接使用 `.ts` 并在导入时写 `.js` 后缀，或统一使用 `.ts` 并确保 `tsx` 环境）。

实际上，`renderer.ts` 使用 `pathToFileURL` 动态导入，它依赖于文件系统上的实际文件。如果主题文件是 `.ts`，而 `tsx` 注册了钩子，则可以正常工作。但为了最大兼容性，推荐将主题模板编译为 `.js`，或明确依赖 `tsx` 运行时。

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
// partials/tagCloud.ts
export function renderTagCloud(ctx: AuraContext, collectionName: string, opts: { limit?: number } = {}) {
  const coll = ctx.collections.find(c => c.name === collectionName);
  if (!coll) return '<p>No tags</p>';

  const tagCount: Record<string, number> = {};
  for (const item of coll.items) {
    const tags = item.metadata?.tags || [];
    for (const tag of tags) {
      tagCount[tag] = (tagCount[tag] || 0) + 1;
    }
  }

  const sorted = Object.entries(tagCount).sort((a, b) => b[1] - a[1]);
  const limited = opts.limit ? sorted.slice(0, opts.limit) : sorted;

  return `
    <div class="tag-cloud">
      ${limited.map(([tag, count]) => `<span class="tag">${tag} (${count})</span>`).join(' ')}
    </div>
  `;
}
```

### 10.3 在模板中使用集合

```typescript
// templates/tags.ts
import { renderTagCloud } from '../partials/tagCloud.js';

export default function(ctx, route, data) {
  const opts = ctx.config.themeOptions?.tags || {};
  const collectionName = opts.collection || 'posts';
  return `
    <h2>标签云</h2>
    ${renderTagCloud(ctx, collectionName, { limit: opts.limit || 30 })}
  `;
}
```

---

## 11. 动态路由与数据映射

动态路由（如 `/posts/:slug`）需要模板能够根据路径参数查找对应的内容项。

### 11.1 路由数据填充

动态路由的数据通常在插件的 `generateRoutes` 钩子中填充 `route.data`。主题开发者应假设 `route.data` 已包含当前页面所需的对象。

### 11.2 详情模板实现

```typescript
// templates/post.ts
export default function(ctx, route, data) {
  // 假定插件已填充 route.data.item
  const item = route.data?.item;
  if (!item) {
    return `<div class="error">内容未找到</div>`;
  }

  // 从配置读取元数据显示开关
  const opts = ctx.config.themeOptions?.post || {};
  const showDate = opts.showDate !== false;
  const showAuthor = opts.showAuthor || false;

  return `
    <article class="post">
      <h1>${item.title || '无标题'}</h1>
      ${showDate && item.date ? `<div class="meta"><time>${new Date(item.date).toLocaleDateString()}</time></div>` : ''}
      ${showAuthor && item.author ? `<div class="author">作者：${item.author}</div>` : ''}
      <div class="content">${item.content || ''}</div>
    </article>
  `;
}
```

### 11.3 列表与详情联动

列表模板（如 `archive.ts`）中的链接应指向详情页路径。建议通过配置指定详情页的基础路径：

```typescript
const detailBase = ctx.config.themeOptions?.routes?.detail || '/posts';
<a href="${detailBase}/${item.slug}">${item.title}</a>
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

### 12.3 编程式注入资源

虽然主要由插件使用，但主题在特殊情况下也可通过 `ctx.assets` 注入资源：

```typescript
// layout.ts 或模板中（但注意模板渲染时 assets 已基本固定，通常不建议）
// 最佳实践是在主题初始化时处理，但主题目前无法运行初始化钩子。
// 因此，若主题需要注入特定 JS，建议在 layout.ts 中直接写 <script> 标签。
```

---

## 13. TypeScript 开发指南

为提升开发体验，为主题编写类型定义。

### 13.1 定义主题配置类型

在主题根目录创建 `types.ts`：

```typescript
// types.ts
export interface MyThemeOptions {
  nav?: Array<{ label: string; url: string }>;
  blog?: {
    namespace?: string;
    key?: string;
    slugField?: string;
    dateFormat?: string;
    showAuthor?: boolean;
  };
  home?: {
    title?: string;
    namespace?: string;
    key?: string;
    emptyMessage?: string;
  };
  // ... 其他配置
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

### 13.3 带类型的模板写法

```typescript
// templates/home.ts
import type { AuraContext, Route } from '../../../src/core/context.js';
import type { MyThemeOptions } from '../types.js';

export default function home(
  ctx: AuraContext,
  route: Route,
  data: Record<string, any>
): string {
  const opts = ctx.config.themeOptions as MyThemeOptions | undefined;
  // ... 类型安全的编码
}
```

---

## 14. 调试与诊断技术

### 14.1 日志输出

模板中可使用 `console.log` 输出调试信息：

```typescript
export default function(ctx, route, data) {
  console.log('[Theme Debug] Route:', route.path);
  console.log('[Theme Debug] Data keys:', Object.keys(data));
  // ...
}
```

构建时，所有日志将输出到终端。

### 14.2 数据快照

若需查看传入模板的完整数据，可在模板中临时输出 JSON（记得在生产前移除）：

```typescript
// 危险操作：会破坏页面，仅用于调试
return `<pre>${JSON.stringify({ config: ctx.config, data, collections: ctx.collections }, null, 2)}</pre>`;
```

### 14.3 常见错误排查

| 错误现象 | 可能原因 | 解决方案 |
|----------|----------|----------|
| `Cannot find module` | 模板导入路径错误 | 使用相对路径并确认文件扩展名（`.ts` 或 `.js`） |
| 页面空白 | 模板函数未返回字符串 | 确保默认导出返回 `string` |
| 样式未生效 | `styles.css` 缺失或路径错误 | 确认文件位于主题根目录 |
| 数据为空 | 配置的 `namespace`/`key` 与插件不匹配 | 打印 `data` 检查实际结构 |
| 路由未找到 | `templates/` 下缺少对应文件 | 创建与 `route.template` 同名的 `.ts` 文件 |

---

## 15. 完整主题示例

以下是一个极简但符合通用性原则的主题 `barebone`。

**目录结构**：

```
playground/themes/barebone/
├── layout.ts
├── styles.css
├── templates/
│   ├── home.ts
│   └── page.ts
└── partials/
    └── utils.ts
```

**`layout.ts`**：

```typescript
export default function layout(ctx, pageHtml, route) {
  const siteTitle = ctx.config.site?.title || 'Barebone';
  const nav = ctx.config.themeOptions?.nav || [];
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${route.path === '/' ? siteTitle : pageTitle(route) + ' - ' + siteTitle}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
  <header><h1><a href="/">${siteTitle}</a></h1>
    <nav>${nav.map(n => `<a href="${n.url}">${n.label}</a>`).join(' | ')}</nav>
  </header>
  <main>${pageHtml}</main>
  <footer>© ${new Date().getFullYear()}</footer>
</body>
</html>`;
}
function pageTitle(route) { return route.data?.title || route.pageType || 'Page'; }
```

**`styles.css`**：

```css
body { font-family: sans-serif; max-width: 960px; margin: 2rem auto; padding: 0 1rem; }
header { border-bottom: 1px solid #ccc; }
```

**`templates/home.ts`**：

```typescript
import { resolveData } from '../partials/utils.js';
export default function(ctx, route, data) {
  const items = resolveData(ctx, data, 'home');
  if (!items.length) return '<p>No content yet.</p>';
  return `<h2>${ctx.config.themeOptions?.home?.title || 'Welcome'}</h2>
    <ul>${items.map(i => `<li><a href="${i.slug}">${i.title}</a></li>`).join('')}</ul>`;
}
```

**`partials/utils.ts`**：

```typescript
export function resolveData(ctx, data, configKey) {
  const opts = ctx.config.themeOptions?.[configKey] || {};
  const ns = opts.namespace || 'content';
  const key = opts.key || 'items';
  return data[ns]?.[key] || [];
}
```

用户配置示例：

```typescript
// aura.config.ts
export default {
  theme: 'barebone',
  themeOptions: {
    nav: [{ label: 'Home', url: '/' }, { label: 'About', url: '/about' }],
    home: { namespace: 'blog', key: 'posts', title: 'Recent Posts' }
  }
};
```