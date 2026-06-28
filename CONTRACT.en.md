# Aura Standard Ecology Contract

## 1. Overview and Core Principles

This contract defines the interaction standards among plugins, themes, and user configurations within the Aura framework.

This contract adheres to the following four principles:

1.  Plugins must output data that conforms to standard interface schemas. UI rendering is separated into two layers: "layout structure" and "visual styling", each handled by different roles.
2.  Themes provide global design tokens and atomic UI component styles; when injecting complex UI, plugins must use the theme-provided style class names to build layouts, ensuring visual integration.
3.  The core does not provide any built-in business components. Plugins store data in the `DataStore` or register with `ctx.components`; themes provide layout slots; users connect the two via "pointers" and "view identifiers" in `themeOptions`.
4.  When data is missing, view identifiers are unsupported by the current theme, or the theme does not provide the style class names required by the plugin, the system must degrade gracefully.

---

## 2. Standard Data Models

This section is for **plugin developers**. When plugins inject data into the `DataStore` or `Collections`, they must normalize it to the following standard interfaces.

### 2.1 General Content Entry

Applicable to core entities such as blog posts, documentation pages, products, portfolios, etc.

```typescript
export interface AuraStandardItem {
  id: string;
  slug: string;
  type: string; // e.g. 'post', 'doc', 'product'
  url?: string;
  title: string;
  content?: string; // Rendered HTML
  excerpt?: string;
  metadata: {
    date?: string;
    updated?: string;
    author?: string;
    tags?: string[];
    category?: string;
    coverImage?: string;
    [key: string]: any; // Allows extension, but themes are not guaranteed to render
  };
  raw?: Record<string, any>;
}
```

### 2.2 Standard Navigation Node

Applicable to sidebar tree navigation, top flat navigation, breadcrumbs, footer links.

```typescript
export interface StandardNavItem {
  title: string;
  url?: string;
  children?: StandardNavItem[];
  active?: boolean; // Usually dynamically computed and injected by the theme at render time
  icon?: string;    // Optional icon identifier
}
```

### 2.3 Standard Table of Contents Node (StandardTocItem)

Applicable to anchor-jump tables of contents within a page.

```typescript
export interface StandardTocItem {
  id: string;       // Corresponding HTML element id
  text: string;     // Plain text heading
  level: number;    // Heading level, e.g. 2, 3, 4
}
```

### 2.4 Data Injection Specification

In the `fetchData` hook, plugins should use the plugin name as a namespace and store standard data under agreed‑upon keys.

Example:
```javascript
async fetchData(ctx) {
  const standardNav = buildNavTree(rawData); // Must return StandardNavItem[]
  ctx.data.set('my-docs-plugin', 'nav', standardNav);
  return {};
}
```

---

## 3. Visual Consistency Protocol

This section is for both **theme developers** and **plugin developers**.

### 3.1 Providing Standardized CSS Utility Classes

Themes must export a set of standardized, semantic CSS utility classes in `styles.css`. These class names define only "visual appearance" and must not contain any layout properties.

#### 3.1.1 Design Tokens

Themes must expose the following design tokens via CSS variables for plugins to reference in custom styles:

```css
:root {
  /* Color system */
  --aura-color-primary: #007bff;
  --aura-color-text: #213547;
  --aura-color-text-light: #476582;
  --aura-color-border: #e2e8f0;
  --aura-color-bg-soft: #f6f8fa;

  /* Typography system */
  --aura-font-sans: system-ui, -apple-system, sans-serif;
  --aura-font-mono: ui-monospace, SFMono-Regular, monospace;
  --aura-font-size-sm: 0.875rem;
  --aura-font-size-base: 1rem;

  /* Spacing system */
  --aura-space-xs: 0.25rem;
  --aura-space-sm: 0.5rem;
  --aura-space-md: 1rem;
  --aura-space-lg: 2rem;

  /* Decoration system */
  --aura-radius-sm: 4px;
  --aura-radius-md: 8px;
}
```

#### 3.1.2 Atomic UI Component Style Classes

Themes must provide style classes for the following standard UI elements. These class names are prefixed with `.aura-ui-` to avoid conflicts with the theme's own layout classes:

| Style Class Name          | Visual Responsibility                                                                                | Prohibited Properties                 |
| :------------------------ | :--------------------------------------------------------------------------------------------------- | :------------------------------------ |
| `.aura-ui-btn`            | Button color, border‑radius, font, hover states                                                      | display, width, margin                |
| `.aura-ui-input`          | Input border, background, font, focus states                                                         | display, width, margin                |
| `.aura-ui-card`           | Card background, border, border‑radius, shadow                                                       | display, grid, width, margin          |
| `.aura-ui-badge`          | Badge/label color, font‑size, border‑radius, padding                                                 | display, position, margin             |
| `.aura-ui-avatar`         | Avatar border‑radius, border, size                                                                   | display, position, margin             |
| `.aura-ui-divider`        | Divider color, thickness                                                                             | display, width, margin                |
| `.aura-ui-typography-h1` … `h6` | Heading font‑size, weight, line‑height, color                                                   | display, margin, padding              |
| `.aura-ui-typography-body` | Body paragraph font‑size, line‑height, color                                                         | display, margin, padding              |
| `.aura-ui-code-inline`    | Inline code background, font, color, border‑radius                                                   | display, margin                       |
| `.aura-ui-code-block`     | Code block background, font, color, border‑radius, padding                                           | display, width, margin                |

All of the above class names define visual appearance only.

### 3.2 Building UI with Theme Style Classes

When plugins inject UI via `entry.browser`, `transformHtml`, or `ctx.components`, they **must preferentially use** the theme‑provided `.aura-ui-*` style classes and `--aura-*` design tokens.

Example:
```html
<section class="my-plugin-comments">
  <h3 class="aura-ui-typography-h2">Comments</h3>

  <div class="my-plugin-comment-list"> <!-- Plugin custom layout -->
    <div class="aura-ui-card my-plugin-comment-item"> <!-- Reuse theme card style -->
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

### 3.3 Degradation Strategy

- When a theme does not provide a certain `.aura-ui-*` class name, the plugin should provide a fallback style for that class in its own `entry.styles`, using `--aura-*` variables to maintain visual consistency. If those variables are also absent, hard‑coded reasonable defaults may be used.
- When a plugin does not use `.aura-ui-*` class names, the theme cannot guarantee visual consistency, but it should not prevent rendering. This is a plugin quality issue and may be noted in plugin reviews or documentation.

---

## 4. Standard Layout and Slot Protocol

This section is for **theme developers**. Themes should not presuppose a site type, but instead provide standard layout skeletons and anonymous slots.

### 4.1 Standard Layout Presets

Themes must support the following standard layout identifiers in CSS and `layout.ts`, triggered via the user‑configured `layouts` dictionary:

- `single`: Single‑column layout, no sidebar.
- `two-col-left`: Two‑column layout, left sidebar, main content area on the right.
- `two-col-right`: Two‑column layout, right sidebar, main content area on the left.
- `three-col`: Three‑column layout, left sidebar, main content area in the centre, right sidebar.

### 4.2 Standard Slot Positions

Themes must reserve the following standard logical slots in the HTML skeleton. Themes should not hard‑code business components inside slots.

- `header`: Global top area.
- `footer`: Global bottom area.
- `aside-start`: Sidebar start position (left side in LTR languages).
- `aside-end`: Sidebar end position (right side in LTR languages).
- `content-before`: Immediately above the main content area.
- `content-after`: Immediately below the main content area.

---

# 5. User Configuration Guide: Connecting Plugins and Themes

This section is for **site builders**.

## 5.1 Core Configuration Structure Overview

A standard Aura configuration file consists of three core parts:

```typescript
// aura.config.ts
export default {
  // 1. Base declarations: specify the current theme and enabled plugins
  theme: 'aura-canvas',
  plugins: ['aura-docs', 'aura-comments'],

  // 2. Theme options: all presentation‑related configuration goes here
  themeOptions: {
    // 2.1 Data source pointers: define logical data aliases
    bindings: { ... },

    // 2.2 Layout presets: define page skeletons for different content types
    layouts: { ... },

    // 2.3 Slot views: define what content is rendered in each position
    slots: { ... }
  }
};
```

## 5.2 Data Source Pointers

Plugins store data in a namespaced storage area, but themes should not know that specific name. Bindings serve to create a "logical alias" so that themes recognise only the alias, not the specific plugin.

```typescript
bindings: {
  // Format: [logical alias]: { source: 'datastore', target: '[pluginName]:[dataKey]' }

  // Point the alias "sidebar" to the tree data provided by the aura-docs plugin
  sidebar: { source: 'datastore', target: 'aura-docs:tree' },

  // Point the alias "comments" to the list data provided by the aura-comments plugin
  comments: { source: 'datastore', target: 'aura-comments:list' },

  // Can also point to a collection
  recentPosts: { source: 'collection', target: 'posts' }
}
```

## 5.3 Layout Presets

Different content types may require different page skeletons. The `layouts` dictionary maps content types to layout identifiers.

```typescript
layouts: {
  // When the content type is 'doc', use the three‑column layout
  doc: 'three-col',

  // When the content type is 'post', use the two‑column left layout
  post: 'two-col-left',

  // Default layout
  default: 'single'
}
```

**Reference for standard layout identifiers:**

| Identifier      | Description                                      |
| :-------------- | :----------------------------------------------- |
| `single`        | Single column, no sidebar                        |
| `two-col-left`  | Left sidebar + right main content                |
| `two-col-right` | Left main content + right sidebar                |
| `three-col`     | Left sidebar + centre main content + right sidebar |

> For which layout identifiers are actually supported, please refer to the documentation of the theme you are using. The above are the recommended standard identifiers for Aura.

## 5.4 Slot Views

### 5.4.1 Standard Slot Positions

| Slot Position    | Description                              |
| :--------------- | :--------------------------------------- |
| `header`         | Top navigation area of the page          |
| `footer`         | Bottom information area of the page      |
| `aside-start`    | Sidebar start position (usually left)    |
| `aside-end`      | Sidebar end position (usually right)     |
| `content-before` | Immediately above the main content area  |
| `content-after`  | Immediately below the main content area  |

### 5.4.2 Slot Configuration Syntax

Each slot configuration contains three fields:

```typescript
slots: {
  'aside-start': {
    // [Required] View identifier, specifies the rendering logic
    view: 'tree-nav',

    // [Optional] Data binding, references an alias defined in bindings
    binding: 'sidebar',

    // [Optional] Direct data source, reads from the current route data; use either binding or source
    // source: 'metadata.toc',

    // [Optional] Custom configuration passed to the render function
    props: { collapsible: true, depth: 3 }
  }
}
```

### 5.4.3 Difference Between the Two Data Sources

| Approach   | Syntax                    | Use Case                                            |
| :--------- | :------------------------ | :-------------------------------------------------- |
| `binding`  | `binding: 'sidebar'`      | Reference global data                               |
| `source`   | `source: 'metadata.toc'`  | Reference local data from the current page          |

> If both `binding` and `source` are configured, `binding` takes precedence.

### 5.4.4 Complete Slot Configuration Example

```typescript
slots: {
  // Left sidebar renders tree navigation, data comes from bindings.sidebar
  'aside-start': {
    view: 'tree-nav',
    binding: 'sidebar'
  },

  // Right sidebar renders the table of contents, data comes from the current page's metadata.toc
  'aside-end': {
    view: 'toc',
    source: 'metadata.toc'
  },

  // Below the main content renders the comment section, self‑rendered by the plugin
  'content-after': {
    view: 'comments',
    binding: 'comments'
  },

  // Above the main content renders breadcrumbs
  'content-before': {
    view: 'breadcrumbs',
    source: 'metadata.breadcrumbs'
  }
}
```

## 5.5 View Identifier Description

The `view` field is an open string; its specific values are determined by the theme you are using. The contract does not mandate a unified list of views in order to preserve thematic creativity.

Please refer to the theme README. A qualified theme must clearly list:
- View identifier names (e.g. `tree-nav`, `toc`, `comments`)
- Required data types (e.g. `StandardNavItem[]`, `StandardTocItem[]`)
- Rendering effect preview or description

## 5.6 Complete Configuration Example

Below is a typical documentation site configuration:

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

## 6. Plugin UI Injection Protocol

This section specifies the three legitimate ways for plugins to inject UI, ensuring that neither the theme’s generality is broken nor visual consistency is lost for complex interactive components.

### 6.1 Lightweight Injection: `entry.styles` + `transformHtml`

Must use `--aura-*` design tokens or `.aura-ui-*` class names. Should not affect the main page layout flow; recommended to insert into designated slot containers.

### 6.2 Heavyweight Injection: `entry.browser` + Mount Points

**How it works**:
1.  The plugin declares `entry.browser` in `manifest.json`.
2.  The theme renders a mount container in the corresponding slot: `<div data-aura-mount="comments"></div>`.
3.  The plugin’s browser script finds the container via `document.querySelector('[data-aura-mount="comments"]')` and injects the UI.  
    **Requirement**: The plugin brings its own complete CSS via `entry.styles`, but **must use `.aura-ui-*` class names and `--aura-*` variables**.

### 6.3 Build‑time Component Registration: `ctx.components.set()`

**How it works**:
1.  The plugin registers in the `buildStart` or `fetchData` hook: `ctx.components.set('aura-comments:ssr', renderFunction)`.
2.  The theme calls it in the template: `const html = ctx.components.get('aura-comments:ssr')?.(data, props)`.  
    **Requirement**: The HTML output by the render function must use `.aura-ui-*` class names.

---

## 7. Developer Obligations

### 7.1 Plugin Developer Obligations

1.  In `fetchData` or `generateRoutes`, never throw raw API data directly. An adapter must be written to map it to the contract’s standard types.
2.  Always use the plugin name as the namespace for the `DataStore` to avoid conflicts with other plugins.
3.  If injecting UI, must use `.aura-ui-*` class names and `--aura-*` variables. Provide fallback styles in `entry.styles`.
4.  In the README, state: the standard data types output; supported view identifiers; if self‑rendered UI is provided, describe the mount‑point attribute and required theme style class names.
5.  In the README, provide a standard `themeOptions` configuration example.

### 7.2 Theme Developer Obligations

1.  Define the complete set of `--aura-*` CSS variables in `styles.css`.
2.  Implement standard class names such as `.aura-ui-btn`, `.aura-ui-card`, `.aura-ui-input`, etc., with visual properties only, no layout properties.
3.  Clearly list in the theme documentation all supported `view` identifiers, corresponding data type requirements, rendering effect descriptions, and whether mount points are provided for certain views.
4.  `layout.ts` must be an engine that reads the `slots` configuration. Based on the `view` string in the configuration, it dynamically calls the corresponding internal render function of the theme, or renders the plugin mount container.
5.  When encountering an unsupported `view` identifier, or when the data pointed to by `binding` is empty, must return an empty string or render a basic `list` view, and must not throw uncaught exceptions.
6.  Layout containers use pure positional class names like `.c-aside-start`; internal views use business class names like `.c-tree-nav`; `.aura-ui-*` class names are exclusively for atomic visual styles. The three must not pollute each other.