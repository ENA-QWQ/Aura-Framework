# Aura 标准生态契约

## 1. 概述与核心原则

本契约定义了 Aura 框架中插件、主题与用户配置之间的交互标准。

本契约遵循以下四大原则：

1.  **插件必须输出符合标准接口（Schema）的数据。** UI 渲染分为“布局结构”与“视觉样式”两层，分别由不同角色负责。
2.  **主题提供全局设计令牌（Design Tokens）和原子级 UI 组件样式；** 插件在注入复杂 UI 时，必须使用主题提供的样式类名来构建布局，确保视觉融合。
3.  **内核不提供任何内置的业务组件。** 插件将数据存入 `DataStore` 或注册到 `ctx.components`，主题提供布局插槽（Slots），用户通过 `themeOptions` 中的“指针（Pointer）”和“视图标识符（View Identifier）”将两者连接。
4.  **当数据缺失、视图标识符不被当前主题支持、或主题未提供插件所需的样式类名时，系统必须降级。**

---

## 2. 标准数据模型

本节面向**插件开发者**。插件在将数据注入 `DataStore` 或 `Collections` 时，必须将其清洗为以下标准接口。

### 2.1 通用内容条目

适用于博客文章、文档页、商品、作品集等核心实体。

```typescript
export interface AuraStandardItem {
    id: string;
    slug: string;
    type: string; // 比如 'post', 'doc', 'product'
    url?: string;
    title: string;
    content?: string; // 渲染后的 HTML
    excerpt?: string;
    metadata: {
        date?: string;
        updated?: string;
        author?: string;
        tags?: string[];
        category?: string;
        coverImage?: string;
        [key: string]: any; // 允许扩展，但主题不保证渲染
    };
    raw?: Record<string, any>;
}
```

### 2.2 标准导航节点

适用于侧边栏树状导航、顶部扁平导航、面包屑、页脚链接。

```typescript
export interface StandardNavItem {
    title: string;
    url?: string;
    children?: StandardNavItem[];
    active?: boolean; // 通常由主题在渲染时动态计算注入
    icon?: string;    // 可选的图标标识符
}
```

### 2.3 标准目录节点 (StandardTocItem)

适用于页面内的锚点跳转目录。

```typescript
export interface StandardTocItem {
    id: string;       // 对应的 HTML 元素 id
    text: string;     // 纯文本标题
    level: number;    // 标题层级，如 2, 3, 4
}
```

### 2.4 数据注入规范

插件在 `fetchData` 钩子中，应使用插件名作为命名空间，并将标准数据存入约定的键名中。

示例：
```javascript
async fetchData(ctx) {
    const standardNav = buildNavTree(rawData); // 必须返回 StandardNavItem[]
    ctx.data.set('my-docs-plugin', 'nav', standardNav);
    return {};
}
```

---

## 3. 视觉一致性协议

本节同时面向**主题开发者**和**插件开发者**。

### 3.1 提供标准化 CSS 工具类

主题必须在 `styles.css` 中导出一套标准化的、语义化的 CSS 工具类。这些类名只定义“视觉表现”，不包含任何布局属性。

#### 3.1.1 设计令牌

主题必须通过 CSS 变量暴露以下设计令牌，供插件在自定义样式中引用：

```css
:root {
    /* 颜色系统 */
    --aura-color-primary: #007bff;
    --aura-color-text: #213547;
    --aura-color-text-light: #476582;
    --aura-color-border: #e2e8f0;
    --aura-color-bg-soft: #f6f8fa;

    /* 排版系统 */
    --aura-font-sans: system-ui, -apple-system, sans-serif;
    --aura-font-mono: ui-monospace, SFMono-Regular, monospace;
    --aura-font-size-sm: 0.875rem;
    --aura-font-size-base: 1rem;

    /* 间距系统 */
    --aura-space-xs: 0.25rem;
    --aura-space-sm: 0.5rem;
    --aura-space-md: 1rem;
    --aura-space-lg: 2rem;

    /* 装饰系统 */
    --aura-radius-sm: 4px;
    --aura-radius-md: 8px;
}
```

#### 3.1.2 原子级 UI 组件样式类

主题必须提供以下标准 UI 元素的样式类。这些类名以 `.aura-ui-` 为前缀，确保不与主题自身的布局类名冲突：

| 样式类名 | 视觉职责 | 禁止包含的属性 |
| :--- | :--- | :--- |
| `.aura-ui-btn` | 按钮的颜色、圆角、字体、hover 状态 | display, width, margin |
| `.aura-ui-input` | 输入框的边框、背景、字体、focus 状态 | display, width, margin |
| `.aura-ui-card` | 卡片的背景、边框、圆角、阴影 | display, grid, width, margin |
| `.aura-ui-badge` | 标签/徽章的颜色、字号、圆角、内边距 | display, position, margin |
| `.aura-ui-avatar` | 头像的圆角、边框、尺寸 | display, position, margin |
| `.aura-ui-divider` | 分割线的颜色、粗细 | display, width, margin |
| `.aura-ui-typography-h1` ~ `h6` | 各级标题的字号、字重、行高、颜色 | display, margin, padding |
| `.aura-ui-typography-body` | 正文段落的字号、行高、颜色 | display, margin, padding |
| `.aura-ui-code-inline` | 行内代码的背景、字体、颜色、圆角 | display, margin |
| `.aura-ui-code-block` | 代码块的背景、字体、颜色、圆角、内边距 | display, width, margin |

以上所有类名仅定义视觉外观。

### 3.2 使用主题样式类构建 UI

当插件通过 `entry.browser`、`transformHtml` 或 `ctx.components` 注入 UI 时，**必须优先使用主题提供的 `.aura-ui-*` 样式类和 `--aura-*` 设计令牌**。

示例：
```html
<section class="my-plugin-comments">
    <h3 class="aura-ui-typography-h2">Comments</h3>

    <div class="my-plugin-comment-list"> <!-- 插件自定义布局 -->
        <div class="aura-ui-card my-plugin-comment-item"> <!-- 复用主题卡片样式 -->
            <img class="aura-ui-avatar" src="..." alt="User" />
            <div class="my-plugin-comment-body">
                <strong class="aura-ui-typography-body">Alice</strong>
                <p class="aura-ui-typography-body">Great article!</p>
                <button class="aura-ui-btn aura-ui-btn--sm">Reply</button>
            </div>
        </div>
    </div>

    <form class="my-plugin-comment-form">
        <input class="aura-ui-input" type="text" placeholder="Write a comment..." />
        <button class="aura-ui-btn" type="submit">Submit</button>
    </form>
</section>
```

### 3.3 降级策略

-   主题未提供某个 `.aura-ui-*` 类名时，插件应在自身 `entry.styles` 中提供该类的 fallback 样式，使用 `--aura-*` 变量保持视觉一致。若变量也不存在，则使用硬编码的合理默认值。
-   插件未使用 `.aura-ui-*` 类名时，主题无法保证其视觉一致性，但不应阻止渲染。这属于插件质量问题，可在插件审核或文档中标注。

---

## 4. 标准布局与插槽协议

本节面向**主题开发者**。主题不应预设站点类型，而应提供标准的布局骨架和匿名插槽。

### 4.1 标准布局预设

主题应在 CSS 和 `layout.ts` 中支持以下标准布局标识符，通过用户配置的 `layouts` 字典触发：

-   `single`: 单栏布局，无侧边栏。
-   `two-col-left`: 双栏布局，左侧边栏，主内容区在右。
-   `two-col-right`: 双栏布局，右侧边栏，主内容区在左。
-   `three-col`: 三栏布局，左侧边栏，主内容区居中，右侧边栏。

### 4.2 标准插槽位置

主题必须在 HTML 骨架中预留以下标准逻辑插槽。主题不应硬编码插槽内的业务组件。

-   `header`: 全局顶部区域。
-   `footer`: 全局底部区域。
-   `aside-start`: 侧边栏起始位置（LTR 语言下为左侧）。
-   `aside-end`: 侧边栏结束位置（LTR 语言下为右侧）。
-   `content-before`: 主内容区正上方。
-   `content-after`: 主内容区正下方。

---

# 5. 用户配置指南：连接插件与主题

本节面向**站点搭建者**。

## 5.1 核心配置结构总览

一个标准的 Aura 配置文件由三个核心部分组成：

```typescript
// aura.config.ts
export default {
    // 1. 基础声明：指定当前使用的主题和启用的插件
    theme: 'aura-canvas',
    plugins: ['aura-docs', 'aura-comments'],

    // 2. 主题选项：所有与表现层相关的配置都放在这里
    themeOptions: {
        // 2.1 数据源指针：定义逻辑数据别名
        bindings: { ... },

        // 2.2 布局预设：定义不同内容类型的页面骨架
        layouts: { ... },

        // 2.3 插槽视图：定义每个位置渲染什么内容
        slots: { ... }
    }
};
```

## 5.2 数据源指针

插件会将数据存入一个带命名空间的存储区。但主题不应该知道这个具体的名字。
Bindings 的作用就是建立一个“逻辑别名”，让主题只认识别名，而不认识具体的插件。

```typescript
bindings: {
    // 格式：[逻辑别名]: { source: 'datastore', target: '[插件名]:[数据键]' }

    // 将 "sidebar" 这个别名，指向 aura-docs 插件提供的 tree 数据
    sidebar: { source: 'datastore', target: 'aura-docs:tree' },

    // 将 "comments" 这个别名，指向 aura-comments 插件提供的 list 数据
    comments: { source: 'datastore', target: 'aura-comments:list' },

    // 也可以指向集合
    recentPosts: { source: 'collection', target: 'posts' }
}
```

## 5.3 布局预设

不同的内容类型可能需要不同的页面骨架。`layouts` 字典将内容类型映射到布局标识符。

```typescript
layouts: {
    // 当内容的 type 为 'doc' 时，使用三栏布局
    doc: 'three-col',

        // 当内容的 type 为 'post' 时，使用双栏左侧布局
        post: 'two-col-left',

    // 默认布局
default: 'single'
}
```

**标准布局标识符参考：**

| 标识符          | 说明                         | 
| :-------------- | :--------------------------- |
| `single`        | 单栏，无侧边栏               |
| `two-col-left`  | 左侧边栏 + 右侧主内容        | 
| `two-col-right` | 左侧主内容 + 右侧边栏        | 
| `three-col`     | 左侧栏 + 中间主内容 + 右侧栏 |

> 具体支持哪些布局标识符，请查阅你所使用主题的文档。以上为 Aura 推荐的标准标识符。

## 5.4 插槽视图

### 5.4.1 标准插槽位置

| 插槽位置         | 说明                     |
| :--------------- | :----------------------- |
| `header`         | 页面顶部导航区域         |
| `footer`         | 页面底部信息区域         |
| `aside-start`    | 侧边栏起始位置（通常为左） |
| `aside-end`      | 侧边栏结束位置（通常为右） |
| `content-before` | 主内容区正上方           |
| `content-after`  | 主内容区正下方           |

### 5.4.2 插槽配置语法

每个插槽的配置包含三个字段：

```typescript
slots: {
    'aside-start': {
        // [必填] 视图标识符，指定渲染逻辑
        view: 'tree-nav',

            // [可选] 数据绑定，引用 bindings 中定义的别名
            binding: 'sidebar',

            // [可选] 直接数据源，从当前路由数据中读取，与 binding 二选一
            // source: 'metadata.toc',

            // [可选] 传递给渲染函数的自定义配置
            props: { collapsible: true, depth: 3 }
    }
}
```

### 5.4.3 两种数据来源的区别

| 方式      | 语法                          | 适用场景                             |
| :-------- | :---------------------------- | :----------------------------------- |
| `binding` | `binding: 'sidebar'`          | 引用全局数据     |
| `source`  | `source: 'metadata.toc'`      | 引用当前页面的局部数据 |

> 如果同时配置了 `binding` 和 `source`，`binding` 优先。

### 5.4.4 完整插槽配置示例

```typescript
slots: {
    // 左侧边栏渲染树状导航，数据来自 bindings.sidebar
    'aside-start': {
        view: 'tree-nav',
            binding: 'sidebar'
    },

    // 右侧边栏渲染页内目录，数据来自当前页面的 metadata.toc
    'aside-end': {
        view: 'toc',
            source: 'metadata.toc'
    },

    // 主内容下方渲染评论区，由插件自渲染
    'content-after': {
        view: 'comments',
            binding: 'comments'
    },

    // 主内容上方渲染面包屑
    'content-before': {
        view: 'breadcrumbs',
            source: 'metadata.breadcrumbs'
    }
}
```

## 5.5 视图标识符说明

`view` 字段是一个开放字符串，它的具体取值由你使用的主题决定。契约不强制规定统一的视图列表，以保证主题的创意自由。

请查阅主题 README。一个合格的主题必须明确列出：
-   视图标识符名称（如 `tree-nav`、`toc`、`comments`）
-   所需的数据类型（如 `StandardNavItem[]`、`StandardTocItem[]`）
-   渲染效果预览或描述

## 5.6 完整配置示例

以下是一个典型的文档站配置：

```typescript
export default {
    theme: 'aura-canvas',
    plugins: ['aura-docs', 'aura-comments'],

    themeOptions: {
        bindings: {
            sidebar: { source: 'datastore', target: 'aura-docs:tree' },
            comments: { source: 'datastore', target: 'aura-comments:list' }
        },

        layouts: {
            doc: 'three-col',
            default: 'single'
        },

        slots: {
            'aside-start': { view: 'tree-nav', binding: 'sidebar' },
            'aside-end': { view: 'toc', source: 'metadata.toc' },
            'content-before': { view: 'breadcrumbs', source: 'metadata.breadcrumbs' },
            'content-after': { view: 'comments', binding: 'comments' }
        },

        nav: [{ label: 'Docs', url: '/docs' }],
        footer: { links: [{ label: 'GitHub', url: 'https://github.com' }] }
    }
};
```

---

## 6. 插件 UI 注入协

本节规范插件注入 UI 的三种合法途径，确保既不破坏主题通用性，又能实现复杂交互组件的视觉一致性。

### 6.1 轻量级注入 `entry.styles` + `transformHtml`

必须使用 `--aura-*` 设计令牌，或使用 `.aura-ui-*` 类名。<br>
不应影响页面主布局流，推荐插入到指定插槽容器中。

### 6.2 重量级注入 `entry.browser` + 挂载点

**工作方式**：
1.  插件在 `manifest.json` 中声明 `entry.browser`。
2.  主题在对应插槽中渲染一个挂载容器：`<div data-aura-mount="comments"></div>`。
3.  插件的浏览器脚本通过 `document.querySelector('[data-aura-mount="comments"]')` 找到容器并注入 UI。<br>
    **要求**：插件通过 `entry.styles` 自带完整 CSS，但**必须使用 `.aura-ui-*` 类名和 `--aura-*` 变量**。

### 6.3 构建时组件注册 `ctx.components.set()`

**工作方式**：
1.  插件在 `buildStart` 或 `fetchData` 钩子中注册：`ctx.components.set('aura-comments:ssr', renderFunction)`。
2.  主题在模板中调用：`const html = ctx.components.get('aura-comments:ssr')?.(data, props)`。<br>
    **要求**：渲染函数输出的 HTML 必须使用 `.aura-ui-*` 类名。

---

## 7. 开发者义务

### 7.1 插件开发者义务

1.  在 `fetchData` 或 `generateRoutes` 中，绝不将原始 API 数据直接抛出。必须编写 Adapter 将其映射为契约标准类型。
2.  始终使用插件名作为 `DataStore` 的 namespace，避免与其他插件冲突。
3.  若注入 UI，必须使用 `.aura-ui-*` 类名和 `--aura-*` 变量。在 `entry.styles` 中提供 fallback 样式。
4.  在 README 中说明：输出的标准数据类型；支持的视图标识符；若提供自渲染 UI，说明挂载点属性和所需主题样式类名。
5.  在 README 中提供一段标准的 `themeOptions` 配置示例。

### 7.2 主题开发者义务

1.  在 `styles.css` 中定义完整的 `--aura-*` CSS 变量集。
2.  实现 `.aura-ui-btn`、`.aura-ui-card`、`.aura-ui-input` 等标准类名，且仅包含视觉属性，不包含布局属性。
3.  在主题文档中清晰列出所有支持的 `view` 标识符、对应的数据类型要求、渲染效果说明，以及是否为某些视图提供挂载点。
4.  `layout.ts` 必须是一个读取 `slots` 配置的引擎。根据配置中的 `view` 字符串，动态调用主题内部对应的渲染函数，或渲染插件挂载容器。
5.  当遇到不支持的 `view` 标识符，或 `binding` 指向的数据为空时，必须返回空字符串或渲染基础的 `list` 视图，不允许抛出未捕获的异常。
6.  布局容器使用 `.c-aside-start` 等纯位置类名，内部视图使用 `.c-tree-nav` 等业务类名，`.aura-ui-*` 类名仅用于原子级视觉样式，三者互不污染。