# Aura 插件开发文档

> 本文档由 AI 生成，作者很懒，不想自己写。  
> 内容已根据 Aura 源码实际行为验证和补充。

---

## 1. 概述

插件是放置在框架根目录 `plugins/` 文件夹（与 `src/` 同级）下的独立目录。  
每个插件必须提供一个 `manifest.json` 文件。它也可以提供 Node.js 入口（用于构建时钩子）、浏览器入口（客户端脚本）和样式表。

插件通过在 `aura.config.ts` 的 `plugins` 数组中列出其 `name` 来启用。

**核心原则：** 插件负责提供符合标准契约的数据和逻辑，主题负责提供视觉表现和布局结构。插件注入 UI 时必须遵循 [Aura 标准生态契约](CONTRACT.zh.md) 中的视觉一致性协议。

---

## 2. 目录结构

```
plugins/
  my-plugin/
    manifest.json         # 必需
    node.js               # 可选，Node.js 钩子
    browser.js            # 可选，浏览器脚本（ES Module）
    styles.css            # 可选，样式文件
    ...                   # 其他资源
```

Aura 在构建开始时扫描该目录，并加载所有在用户配置 `plugins` 列表中出现的插件。

---

## 3. 清单文件（manifest.json）

| 字段          | 类型                               | 必需 | 说明 |
|---------------|------------------------------------|------|------|
| `name`        | string                             | 是   | 唯一标识符，必须与文件夹名一致，并且在 `aura.config.ts` 中引用。 |
| `version`     | string                             | 否   | 插件版本号。 |
| `enforce`     | `"pre"` \| `"normal"` \| `"post"`  | 否   | 执行阶段顺序，默认为 `"normal"`。 |
| `dependencies`| string[]                           | 否   | 依赖的其他插件名称列表，确保这些插件先于当前插件执行。 |
| `schema`      | object                             | 否   | 用于验证通过 `DataStore` 存储的数据结构定义。键为数据键名，值为 `SchemaDefinition`。 |
| `entry`       | object                             | 否   | 入口文件路径配置。 |
| `entry.node`  | string                             | 否   | Node.js 入口文件路径（相对于插件目录）。该文件应导出 `PluginHooks` 对象或默认导出包含钩子方法的对象。 |
| `entry.browser`| string                            | 否   | 浏览器脚本路径（注入到 `<body>` 中作为外部 `<script type="module">`）。 |
| `entry.styles` | string                            | 否   | 样式表路径（注入到 `<head>` 中作为内联 `<style>`）。**必须使用 `.aura-ui-*` 类名和 `--aura-*` 变量。** |

### SchemaDefinition 类型

```typescript
interface SchemaDefinition {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  items?: SchemaDefinition;                      // 当 type 为 'array' 时使用
  properties?: Record<string, SchemaDefinition>; // 当 type 为 'object' 时使用
  required?: boolean;                            // 默认为 false
}
```

带 schema 的清单示例：

```json
{
  "name": "blog",
  "version": "1.0.0",
  "enforce": "normal",
  "dependencies": [],
  "schema": {
    "posts": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "title": { "type": "string", "required": true },
          "date": { "type": "string" }
        }
      }
    }
  },
  "entry": {
    "node": "node.js",
    "browser": "browser.js",
    "styles": "styles.css"
  }
}
```

---

## 4. 插件钩子（Hooks）

所有钩子定义在 `PluginHooks` 接口中。它们可以是同步或异步的（返回 Promise）。  
钩子按照 `enforce` 和 `dependencies` 确定的顺序（拓扑排序）依次调用。

### 钩子类型

- **触发型（Trigger）** – 仅用于副作用，不接收或返回数据载荷。
- **瀑布型（Waterfall）** – 接收上一个插件的返回值，并返回新值；最终值作为该阶段的结果。

### 钩子列表

| 钩子名                 | 类型       | 参数                                                               | 返回值             | 说明 |
|------------------------|------------|--------------------------------------------------------------------|--------------------|------|
| `buildStart`           | 触发型     | `(ctx: AuraContext) => void`                                       | -                  | 构建开始时调用一次，适合初始化。 |
| `loadContent`          | 瀑布型     | `(collections: Collection[], ctx: AuraContext) => Collection[]`    | `Collection[]`     | 加载或生成内容集合。返回的数组 **替换** `ctx.collections`。 |
| `fetchData`            | 触发型     | `(ctx: AuraContext) => Record<string, any>`                        | 数据对象           | 获取任意数据。返回的对象会自动以插件名为命名空间存储到 `ctx.data` 中（每个键一个属性）。你也可以手动调用 `ctx.data.set()`。 |
| `transformCollections` | 瀑布型     | `(collections: Collection[], ctx: AuraContext) => Collection[]`    | `Collection[]`     | 在 `loadContent` 之后转换集合。返回的数组 **替换** 集合列表。 |
| `generateRoutes`       | 瀑布型     | `(routes: Route[], ctx: AuraContext) => Route[]`                   | `Route[]`          | 生成或修改路由。返回的数组 **替换** `ctx.routes`。 |
| `transformHtml`        | 瀑布型     | `(html: string, ctx: AuraContext, route: Route) => string`         | `string`           | 在写入磁盘前转换每个路由的最终 HTML。 |
| `buildEnd`             | 触发型     | `(ctx: AuraContext) => void`                                       | -                  | 所有文件写入后调用，适合清理或统计。 |

**重要：** `loadContent`、`transformCollections` 和 `generateRoutes` 是**替换型**钩子，而非合并型。返回的值会完全替换当前状态。

---

## 5. 上下文（AuraContext）

每个钩子都接收 `ctx` 对象，其中包含所有构建状态和工具。

```typescript
interface AuraContext {
  config: ResolvedConfig;            // 最终解析的配置
  collections: Collection[];         // 当前集合列表
  routes: Route[];                   // 当前路由列表
  data: DataStore;                   // 跨插件数据存储
  assets: AssetManager;              // 资源管理器
  components: Map<string, Function>; // 组件注册表（供模板使用）
  viewRegistry: Map<string, Function>; // 视图注册表（供主题渲染引擎使用）
}
```

### DataStore

用于在插件之间共享结构化数据，支持可选的 schema 验证。

```typescript
class DataStore {
  set(namespace: string, key: string, value: any, schema?: SchemaDefinition): void;
  get(namespace: string, key: string): any;
  getFlat(): Record<string, any>; // 返回 { namespace: { key: value, ... }, ... }
}
```

- `namespace` 建议使用你的插件名以避免冲突。
- 如果提供了 `schema`，会立即验证，验证失败则抛出错误。

在 `fetchData` 中，如果你返回一个对象，Aura 会自动为每个键调用 `ctx.data.set(pluginName, key, value)`，并使用清单中定义的 schema（如果有）。你也可以手动调用 `set()`。

### AssetManager

用于添加 CSS/JS 资源，这些资源会被注入到最终 HTML 中。

```typescript
class AssetManager {
  add(type: 'css' | 'js', content: string, inject: 'head' | 'body', filename?: string, pluginName?: string): void;
  getAssets(): AssetDescriptor[];
}
```

- `type` – 资源类型。
- `content` – 原始代码或文件内容。
- `inject` – 注入位置（`head` 或 `body`）。
- `filename` + `pluginName` – 如果提供，资源会被写入 `outDir/assets/plugins/pluginName/filename` 并以外部资源方式链接；否则内联注入。

**注意：** 框架会自动处理 `entry.browser` 和 `entry.styles` —— 它们会在内部通过 `assets.add()` 添加。你只需为动态生成的资源调用 `assets.add()`。

### ViewRegistry

用于注册自定义视图渲染函数。主题渲染引擎会根据 `themeOptions.slots` 中的 `view` 标识符从此注册表中查找渲染函数。

```typescript
ctx.viewRegistry.set('my-custom-view', (data, ctx, props) => {
  return `<div class="aura-ui-card">${data.title}</div>`;
});
```

---

## 6. 集合（Collection）与路由（Route）

### Collection

```typescript
interface Collection {
  name: string;          // 例如 "posts"
  items: CollectionItem[];
}

interface CollectionItem {
  id: string;            // 唯一标识符
  slug: string;          // URL 友好的标识符
  collection: string;    // 所属集合名称
  metadata: Record<string, any>; // 前置元数据或自定义字段
  content: string;       // 原始正文（Markdown、HTML 等）
}
```

集合是组织内容的主要方式。通常你在 `loadContent` 或 `transformCollections` 中生成它们。

### Route

```typescript
interface Route {
  path: string;          // 例如 "/posts/hello-world"
  pageType: string;      // 页面类型标识符，用于匹配主题布局（如 'home', 'doc', 'page'）
  collection?: string;   // 可选 – 你可以用它来关联集合，但核心渲染器并不使用它
  data: Record<string, any>; // 传递给模板的数据
}
```

路由在 `generateRoutes` 中生成。之后它们会由主题的渲染引擎根据 `pageType` 和 `themeOptions` 进行渲染。  
对于每个路由，框架会写入 `outDir/path/index.html`（如果 `path === '/'` 则写入 `outDir/index.html`）。

**注意：** `template` 和 `modules` 字段已从 Route 接口中移除，渲染完全由主题驱动。

---

## 7. 完整示例：博客插件

这个插件从 `src/posts/` 读取 Markdown 文件，创建 `"posts"` 集合，为每篇文章生成列表路由和详情路由，并将文章数据存入 `DataStore`。

### 目录结构

```
plugins/blog/
  manifest.json
  node.js
```

### manifest.json

```json
{
  "name": "blog",
  "version": "1.0.0",
  "enforce": "normal",
  "schema": {
    "posts": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "title": { "type": "string", "required": true },
          "slug": { "type": "string", "required": true },
          "date": { "type": "string" }
        }
      }
    }
  },
  "entry": {
    "node": "node.js"
  }
}
```

### node.js（钩子实现）

```typescript
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import matter from 'gray-matter'; // 你需要安装这个包

export default {
  async loadContent(collections, ctx) {
    const postsDir = join(ctx.config.srcDir, 'posts');
    let files = [];
    try {
      files = await readdir(postsDir);
    } catch {
      return []; // 没有 posts 目录，返回空
    }

    const items = [];
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const raw = await readFile(join(postsDir, file), 'utf-8');
      const { data, content } = matter(raw);
      const slug = data.slug || file.replace(/\.md$/, '');
      items.push({
        id: file,
        slug,
        collection: 'posts',
        metadata: data,
        content
      });
    }

    // 返回名为 "posts" 的单个集合
    return [{ name: 'posts', items }];
  },

  // 将文章数据存入 DataStore，供其他插件或主题插槽使用
  async fetchData(ctx) {
    const postsCollection = ctx.collections.find(c => c.name === 'posts');
    if (!postsCollection) return {};
    // 返回一个对象，该对象会以 "blog" 命名空间存入
    return { posts: postsCollection.items };
  },

  async generateRoutes(routes, ctx) {
    const posts = ctx.collections.find(c => c.name === 'posts')?.items || [];

    // 保留已有路由（如果有），并添加新路由
    const newRoutes = [
      ...routes,
      {
        path: '/posts',
        pageType: 'post-list',   // 页面类型，用于匹配主题布局
        data: { posts }          // 传递给主题插槽的数据源
      },
      ...posts.map(post => ({
        path: `/posts/${post.slug}`,
        pageType: 'post-detail', // 页面类型，用于匹配主题布局
        data: { post }
      }))
    ];

    return newRoutes;
  }
};
```

### 数据流向说明

1. `loadContent` 读取文件并返回一个集合。
2. 集合被存入 `ctx.collections`。
3. `fetchData` 读取该集合并将其存入 `ctx.data` 下的 `blog.posts`。
4. `generateRoutes` 使用 `ctx.collections` 构建路由，并将文章数据直接传递到每个路由的 `data` 字段。
5. 主题渲染引擎根据 `pageType` 和 `themeOptions` 中的 `slots` 配置，从 `ctx.data` 或 `route.data` 获取数据并渲染视图。

### 主题配置示例

在用户的 `aura.config.ts` 中：

```typescript
export default {
  theme: 'aura-canvas',
  plugins: ['blog'],
  themeOptions: {
    bindings: {
      blogPosts: { source: 'datastore', target: 'blog:posts' }
    },
    layouts: {
      'post-list': 'two-col-left',
      'post-detail': 'single',
      default: 'single'
    },
    slots: {
      'content-before': {
        view: 'post-list-view', // 主题提供的视图标识符
        binding: 'blogPosts'
      }
    }
  }
};
```

---

## 8. 动态路由与 Slug 处理

核心框架不提供内置的动态路由机制。你需要在 `generateRoutes` 中显式生成路由，如上所示。  
要支持分页、标签归档等，只需用相同方式生成多个路由对象，每个携带自己的 `data`。

示例：为每个标签生成路由：

```typescript
const tags = new Set();
posts.forEach(p => (p.metadata.tags || []).forEach(t => tags.add(t)));
const tagRoutes = [...tags].map(tag => ({
  path: `/tags/${tag}`,
  pageType: 'tag-archive',
  data: { tag, posts: posts.filter(p => (p.metadata.tags || []).includes(tag)) }
}));
```

---

## 9. 错误处理与调试

- 如果钩子抛出错误，Aura 会捕获它，记录插件名称和错误信息，然后继续构建（除非是致命错误，例如插件循环依赖）。
- 建议你在文件 I/O 和外部 API 调用处使用 try/catch，并用 `console.warn` 或 `console.error` 输出有意义的日志。
- 要查看当前有哪些数据，你可以在钩子中临时打印 `ctx.data.getFlat()` 或 `ctx.collections`。

---

## 10. 插件间通信

- 使用 `DataStore` 在插件之间共享数据。例如，一个插件可以存储配置：`ctx.data.set('myplugin', 'config', {...})`，另一个插件通过 `ctx.data.get('myplugin', 'config')` 获取。
- 使用一致的命名空间（最好用插件名）以避免意外覆盖。

---

## 11. 浏览器端脚本与样式

- `entry.browser` 作为外部 `<script type="module">` 注入，指向 `assets/plugins/<pluginName>/<filename>`。
- `entry.styles` 作为内联 `<style>` 注入到 `<head>` 中。
- 如果你需要添加动态客户端代码，可以从钩子（例如 `transformHtml` 或 `buildEnd`）中调用 `ctx.assets.add('js', code, 'body', 'dynamic.js', 'myplugin')`。
- 框架在每个页面中注入全局事件总线 `window.AuraBus`。你可以用它来在不同浏览器脚本之间通信。
- **重要：** 插件样式必须遵循 [Aura 标准生态契约](CONTRACT.zh.md)，使用 `.aura-ui-*` 类名和 `--aura-*` 变量以确保视觉一致性。

---

## 12. 执行顺序（钩子 + enforce + dependencies）

1. 插件先按 `enforce`（pre → normal → post）排序，再按 `dependencies` 进行拓扑排序。
2. 对于每个钩子阶段，所有实现了该钩子的插件按排序后的顺序依次调用。
3. 对于瀑布型钩子，前一个插件的输出成为后一个插件的输入。

---

## 13. 重要注意事项和陷阱

- `loadContent`、`transformCollections` 和 `generateRoutes` 会**替换**整个数组，而不是合并。如果你想保留之前的值，必须显式复制（例如 `[...previous, ...new]`）。
- `fetchData` 期望返回一个普通对象。如果返回 `undefined`，则不会存储任何数据。
- 路由上的 `collection` 字段不被核心渲染器使用——它仅用于信息传递。你必须将实际数据放在 `data` 中传递。
- 主题渲染引擎通过 `ctx.data.getFlat()` 和 `route.data` 获取数据，并通过 `themeOptions` 中的 `bindings` 和 `slots` 配置进行映射。
- 插件不再直接提供模板文件，而是通过数据绑定和视图标识符与主题协作。

---

## 14. 插件的完整生命周期

1. `discoverAndLoadPlugins` 读取所有清单文件并加载 Node 入口。
2. 插件排序。
3. 调用 `buildStart` 钩子。
4. 依次执行 `loadContent` → `transformCollections` → `fetchData` → `generateRoutes`。
5. 复制并注册 `entry.browser` 和 `entry.styles` 指定的资源文件。
6. 加载并验证主题样式（检查 CSS 变量和原子类名）。
7. 对每个路由：
   - 根据 `pageType` 和 `themeOptions` 确定布局。
   - 遍历 `slots` 配置，从 `ctx.data` 或 `route.data` 获取数据。
   - 根据 `view` 标识符查找渲染函数（优先从 `ctx.viewRegistry`，其次从主题 `views/` 目录）。
   - 调用布局函数组装最终 HTML。
   - 通过 `transformHtml` 注入资源。
   - 写入 HTML 文件。
8. 调用 `buildEnd` 钩子。

---

祝你编码愉快 —— 别忘了，本文档是 AI 生成的。如果仍有不清楚的地方，源代码才是真理。