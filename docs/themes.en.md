# Aura Theme Development Documentation

> This document is AI-generated; the author is too lazy to write it themselves.  
> Content has been verified and supplemented based on actual Aura source code behavior.

---

Aura defines a **Theme** as the presentation layer of a site. A theme is essentially a collection of template functions and style assets that together determine the site's visual appearance and user experience.

### Design Principles for Universality

Aura's theme ecosystem emphasizes **universality** – the same theme should be able to serve multiple site types such as blogs, documentation sites, corporate websites, portfolios, etc. To achieve this, theme developers must follow these core principles:

1. **Data Source Abstraction**: Themes must never hardcode specific plugin or data namespaces. All data references must be dynamically resolved through configuration items (e.g., `themeOptions`).
2. **Separation of Presentation and Content**: Themes are only responsible for "how to display", not "where data comes from". Data is provided by plugins or users via the `DataStore`.
3. **Graceful Degradation**: When data is missing or malformed, templates must elegantly display placeholder content or empty states to ensure page accessibility.
4. **Configuration-Driven Variability**: The visibility, ordering, and formatting of page elements must all be controlled by configuration, not hardcoded.

---

## 2. Environment and Path Resolution

The default `package.json` in the framework root directory is as follows:

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

**Path Resolution Logic** (refer to `config.ts` and `pipeline.ts`):

- The command-line argument `--root <path>` specifies the project root directory, defaulting to `process.cwd()`.
- The configuration file `aura.config.ts` is loaded from the root directory.
- Theme directory resolution: `${root}/srcDir/themes/${theme}`.
    - `srcDir` defaults to `'.'` (i.e., the root), but can be overridden in `aura.config.ts` via `srcDir`.
    - In the default `dev` script, `root` is `./playground`, so the theme path becomes `./playground/themes/<theme-name>/`.
- **Important**: If you customize `srcDir` (e.g., `srcDir: './src'`), the theme path becomes `./src/themes/<theme-name>/`.

---

## 3. Theme Directory Structure Specification

A fully functional theme directory should follow the following structure (recommended specification):

```
playground/themes/my-theme/
├── layout.ts               # [Required] Layout entry point
├── styles.css              # [Recommended] Global styles (auto-injected into <head>)
├── templates/              # [Required] Page template directory
│   ├── home.ts
│   ├── page.ts
│   ├── post.ts
│   └── archive.ts
├── partials/               # [Recommended] Reusable components/partials
│   ├── header.ts
│   ├── footer.ts
│   ├── sidebar.ts
│   └── card.ts
├── assets/                 # [Optional] Theme‑private resources (images, fonts, etc.)
│   ├── logo.svg
│   └── fonts/
├── public/                 # [Optional] Static files copied directly to output directory at build time
│   ├── favicon.ico
│   └── robots.txt
├── types.ts                # [Optional] TypeScript type definitions
└── README.md               # [Recommended] Usage documentation (configuration options)
```

**Directory Responsibilities**:

| Directory/File | Responsibility |
|----------------|----------------|
| `layout.ts` | Defines the page shell (HTML skeleton) shared by all routes. |
| `styles.css` | Global stylesheet, inlined as `<style>` into the `<head>` of every page. |
| `templates/` | Contains content‑rendering functions for specific pages; filenames correspond to the route's `template` field. |
| `partials/` | Reusable UI fragments (functions) called by layouts or templates to avoid duplication. |
| `assets/` | Images, fonts, etc. referenced by CSS/JS; referenced internally via relative paths (e.g., `url('./assets/logo.png')`). |
| `public/` | Files that are copied unmodified to the root of `outDir` (e.g., `favicon.ico`). |

---

## 4. Core Types and Interfaces

Before coding, you must be familiar with the core types exposed by Aura to themes. These types are defined in `context.ts`.

### 4.1 AuraContext

```typescript
interface AuraContext {
  config: ResolvedConfig;          // Fully resolved configuration
  collections: Collection[];       // All content collections
  routes: Route[];                // All routes (resolved at build time)
  data: DataStore;               // Data store instance
  assets: AssetManager;          // Asset manager instance
  components: Map<string, Function>; // Global component registry (plugins may inject)
}
```

### 4.2 ResolvedConfig (Key Subset)

```typescript
interface ResolvedConfig extends UserConfig {
  root: string;          // Absolute path to project root
  outDir: string;        // Absolute path to output directory (default dist)
  srcDir: string;        // Absolute path to source directory (default root)
  theme: string;         // Currently active theme name
  site: SiteConfig;      // Site metadata
  themeOptions?: any;    // [Custom] Theme configuration (core extension point)
  routes: RouteBlueprint[]; // Route blueprints
  plugins: string[];     // Enabled plugin list
}
```

Where `SiteConfig` is defined as:

```typescript
interface SiteConfig {
  title: string;
  description?: string;
  // Users may extend with arbitrary additional fields
}
```

### 4.3 Route (Route Object)

```typescript
interface Route {
  path: string;                    // URL path
  template: string;                // Corresponds to a filename in templates/
  modules: string[];              // Reserved field
  collection?: string;            // Associated collection name (if any)
  pageType?: string;              // Page type ('list' | 'detail' | 'page' etc.)
  data: Record<string, any>;      // Route‑specific data (populated by plugins or resolvers)
}
```

### 4.4 Collection and CollectionItem

```typescript
interface Collection {
  name: string;
  items: CollectionItem[];
}

interface CollectionItem {
  id: string;
  slug: string;
  collection: string;             // Collection name this item belongs to
  metadata: Record<string, any>;  // Metadata (title, date, tags, etc.)
  content: string;               // Main content (typically Markdown or HTML)
}
```

---

## 5. Layout Template (Layout) Deep Dive

### 5.1 Function Signature and Parameters

The layout file (`layout.ts`) must export a function as default with the following signature:

```typescript
type LayoutFunction = (
  ctx: AuraContext,
  pageHtml: string,
  route: Route
) => string | Promise<string>;
```

- **`ctx`**: Full context – provides access to all configuration, data, and collections.
- **`pageHtml`**: HTML content generated by the page template (i.e., content inside `<main>`).
- **`route`**: The route object currently being rendered.

### 5.2 Core Responsibilities of a Layout

The layout should accomplish the following tasks:

1. Output `<!DOCTYPE html>` and the `<html>` root element.
2. In the `<head>`, set charset, viewport, title, description, and other meta tags.
3. Render common navigation, header, and footer.
4. Insert `pageHtml` into the main content area.
5. **Do not** manually include `<style>` or `<script>` tags in the layout to load plugin assets – Aura's renderer (`renderer.ts`) automatically injects them before `</head>` and before `</body>`.

### 5.3 Advanced Layout Techniques

**Dynamic Title Generation**:

```typescript
// layout.ts
export default function layout(ctx, pageHtml, route) {
  const siteTitle = ctx.config.site?.title || 'Untitled';
  const pageTitle = route.data?.title || route.pageType || 'Page';
  const title = route.path === '/' ? siteTitle : `${pageTitle} - ${siteTitle}`;
  // ...
}
```

**Theme‑Configuration‑Driven Navigation**:

```typescript
const nav = ctx.config.themeOptions?.nav || [];
// nav: [{ label: 'Home', url: '/' }, ...]
```

**Conditional Sidebar / Layout**:

```typescript
const layoutType = route.data?.layout || ctx.config.themeOptions?.defaultLayout || 'full';
// Render sidebar based on layoutType
```

---

## 6. Page Templates (Templates) Deep Dive

### 6.1 Function Signature and Parameters

Page templates are located in the `templates/` directory and must export a function as default:

```typescript
type TemplateFunction = (
  ctx: AuraContext,
  route: Route,
  data: Record<string, any>   // Note: this is ctx.data.getFlat() result
) => string | Promise<string>;
```

**Key Difference**:
- The `data` parameter is a **flattened snapshot** of all namespaces in the `DataStore`, structured as `{ [namespace: string]: { [key: string]: any } }`.
- If you need to access collections (`collections`), you must do so via `ctx.collections` directly; it is **not** included in the `data` object.

### 6.2 Data Access Patterns in Templates

Since `data` is flat by namespace, access data using the following pattern:

```typescript
// Bad practice: hardcoding plugin name
const posts = data['my-blog-plugin']?.posts;

// Good practice: resolve namespace via configuration
const ns = ctx.config.themeOptions?.blog?.namespace || 'blog';
const key = ctx.config.themeOptions?.blog?.key || 'posts';
const items = data[ns]?.[key] || [];
```

### 6.3 Error Handling and Placeholders

Always provide fallbacks for missing data:

```typescript
export default function(ctx, route, data) {
  const items = resolveData(ctx, data); // custom resolver
  if (!items || items.length === 0) {
    return `<div class="empty-state">${ctx.config.themeOptions?.emptyMessage || 'No content available.'}</div>`;
  }
  // ... normal rendering
}
```

---

## 7. Data Flow and Data Access Patterns

Understanding Aura's build‑time data pipeline is critical for theme development.

**Data Pipeline Order** (refer to `pipeline.ts`):

1. **`loadContent`** hook: Plugins load initial collections (`Collection[]`).
2. **`transformCollections`** hook: Plugins transform/filter collections.
3. **`fetchData`** hook: Plugins write arbitrary data into the `DataStore`.
4. **Route Resolution** (`resolveRoutes`): Generate the route list.
5. **`generateRoutes`** hook: Plugins modify routes (can attach data to `route.data` here).
6. **Rendering phase**: Theme templates execute, receiving `ctx` and `data`.

**Data Sources Available to Themes**:

| Source | Access Method | Use Case |
|--------|---------------|----------|
| Site config | `ctx.config.site` | Site title, description, URL, etc. |
| Theme config | `ctx.config.themeOptions` | Navigation, layout switches, data mapping config |
| Data store | `data` (i.e., `ctx.data.getFlat()`) | Plugin‑provided business data (posts, products, documents, etc.) |
| Collections | `ctx.collections` | When you need to iterate or look up by slug |
| Route data | `route.data` | Page‑specific data (e.g., detail object for dynamic routes) |

---

## 8. Configuration‑Driven Patterns for Universality

This is the core chapter for achieving theme reusability.

### 8.1 Defining the Theme Configuration Interface

Clearly define the supported `themeOptions` structure in the theme's `README.md`, for example:

```typescript
interface MyThemeOptions {
  // Navigation config
  nav: Array<{ label: string; url: string }>;
  // Blog module config
  blog: {
    namespace: string;      // data namespace
    key: string;           // data key
    slugField: string;     // slug field name
    dateFormat: string;    // date format
    showAuthor: boolean;
  };
  // Sidebar config
  sidebar: {
    enabled: boolean;
    position: 'left' | 'right';
    widgets: string[];     // component list
  };
  // Layout presets
  defaultLayout: 'full' | 'sidebar';
  // Empty state copy
  emptyMessage: string;
}
```

### 8.2 Resolving Configuration in Templates

Write a reusable helper (recommended in `partials/utils.ts`):

```typescript
// partials/utils.ts
export function resolveCollectionData(ctx: AuraContext, data: Record<string, any>, configKey: string) {
  const opts = ctx.config.themeOptions?.[configKey] || {};
  const ns = opts.namespace || 'content';
  const key = opts.key || 'items';
  return data[ns]?.[key] || [];
}
```

### 8.3 Conditional Rendering Example

```typescript
// templates/archive.ts
export default function(ctx, route, data) {
  const opts = ctx.config.themeOptions?.archive || {};
  const showDate = opts.showDate !== false; // default: show
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

## 9. Template Composition and Code Reuse

Avoid repeating code across multiple templates. Use the `partials/` directory to extract common pieces.

### 9.1 Creating a Reusable Partial

`partials/card.ts`:

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

### 9.2 Importing and Using in Templates

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

**Note**: Since Aura dynamically loads templates via `import()`, ensure import paths are relative and include the `.js` extension (even if source is `.ts`, after compilation it becomes `.js`; however, if running via `tsx`, `.ts` can be resolved directly. For safety, it is recommended to use `.ts` in development and write `.js` in imports, or consistently use `.ts` and ensure the `tsx` environment).

In practice, `renderer.ts` uses `pathToFileURL` for dynamic imports, which depends on actual files on disk. If theme files are `.ts` and `tsx` hooks are registered, it will work. For maximum compatibility, we recommend compiling theme templates to `.js`, or explicitly relying on the `tsx` runtime.

---

## 10. Iterating and Using Collections

Collections are a core structure for content organization. Themes can access all collections via `ctx.collections`.

### 10.1 Retrieving a Specific Collection

```typescript
function getCollectionByName(ctx: AuraContext, name: string): Collection | undefined {
  return ctx.collections.find(c => c.name === name);
}
```

### 10.2 Example: Aggregating a Tag Cloud

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

### 10.3 Using Collections in Templates

```typescript
// templates/tags.ts
import { renderTagCloud } from '../partials/tagCloud.js';

export default function(ctx, route, data) {
  const opts = ctx.config.themeOptions?.tags || {};
  const collectionName = opts.collection || 'posts';
  return `
    <h2>Tag Cloud</h2>
    ${renderTagCloud(ctx, collectionName, { limit: opts.limit || 30 })}
  `;
}
```

---

## 11. Dynamic Routes and Data Mapping

Dynamic routes (e.g., `/posts/:slug`) require templates to look up the corresponding content item based on path parameters.

### 11.1 Populating Route Data

Dynamic route data is typically populated by plugins in the `generateRoutes` hook by setting `route.data`. Theme developers should assume that `route.data` already contains the required object for the current page.

### 11.2 Detail Template Implementation

```typescript
// templates/post.ts
export default function(ctx, route, data) {
  // Assume plugin already populated route.data.item
  const item = route.data?.item;
  if (!item) {
    return `<div class="error">Content not found</div>`;
  }

  const opts = ctx.config.themeOptions?.post || {};
  const showDate = opts.showDate !== false;
  const showAuthor = opts.showAuthor || false;

  return `
    <article class="post">
      <h1>${item.title || 'Untitled'}</h1>
      ${showDate && item.date ? `<div class="meta"><time>${new Date(item.date).toLocaleDateString()}</time></div>` : ''}
      ${showAuthor && item.author ? `<div class="author">Author: ${item.author}</div>` : ''}
      <div class="content">${item.content || ''}</div>
    </article>
  `;
}
```

### 11.3 Linking List to Detail

Links in list templates (e.g., `archive.ts`) should point to the detail page path. It is recommended to specify the detail base path via configuration:

```typescript
const detailBase = ctx.config.themeOptions?.routes?.detail || '/posts';
<a href="${detailBase}/${item.slug}">${item.title}</a>
```

---

## 12. Static Assets and Asset Management

### 12.1 Theme‑Private Resources (`assets/`)

Referencing theme‑private resources in CSS:

```css
/* styles.css */
.logo {
  background-image: url('./assets/logo.svg');
}
```

Aura does not actively process the `assets/` directory; resource reference paths are relative to the output file. Since CSS is inlined into `<head>`, `url()` resolution relative to the page path may fail. **Recommended practice**: place public static assets in the `public/` directory and reference them via absolute paths (e.g., `/logo.svg`).

### 12.2 Public Static Assets (`public/`)

During build, `pipeline.ts` executes `cp(publicDir, outDir, { recursive: true })`, copying all contents of `public/` to the root of the output directory. Thus, `public/favicon.ico` is accessible at `/favicon.ico`.

### 12.3 Programmatic Asset Injection

While primarily used by plugins, themes may inject assets in special cases via `ctx.assets`:

```typescript
// In layout.ts or templates (but note that assets are mostly finalised by the time templates render – generally not recommended)
// Best practice: if a theme needs to inject specific JS, write a <script> tag directly in layout.ts.
```

---

## 13. TypeScript Development Guide

To improve the development experience, write type definitions for your theme.

### 13.1 Defining Theme Configuration Types

Create `types.ts` in the theme root:

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
  // ... other config
}
```

### 13.2 Extending Global Aura Types

Create `ambient.d.ts` in the theme directory to extend `ResolvedConfig`:

```typescript
// ambient.d.ts
import { MyThemeOptions } from './types.js';

declare module '../core/context.js' {
  interface ResolvedConfig {
    themeOptions?: MyThemeOptions;
  }
}
```

**Note**: Because Aura uses dynamic imports, type extensions only affect development‑time intellisense and do not impact runtime behavior.

### 13.3 Typed Template Writing

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
  // ... type‑safe coding
}
```

---

## 14. Debugging and Diagnostics

### 14.1 Logging Output

You can use `console.log` in templates for debugging:

```typescript
export default function(ctx, route, data) {
  console.log('[Theme Debug] Route:', route.path);
  console.log('[Theme Debug] Data keys:', Object.keys(data));
  // ...
}
```

All logs will appear in the terminal during build.

### 14.2 Data Snapshot

To inspect the full data passed to a template, temporarily output JSON (remember to remove in production):

```typescript
// Dangerous: breaks the page, for debugging only
return `<pre>${JSON.stringify({ config: ctx.config, data, collections: ctx.collections }, null, 2)}</pre>`;
```

### 14.3 Common Error Troubleshooting

| Symptom | Possible Cause | Solution |
|---------|----------------|----------|
| `Cannot find module` | Incorrect import path | Use relative path and verify file extension (`.ts` or `.js`) |
| Blank page | Template function does not return a string | Ensure default export returns a `string` |
| Styles not applied | Missing `styles.css` or incorrect path | Confirm file exists at theme root |
| Empty data | Configured `namespace`/`key` mismatch with plugin | Print `data` to inspect actual structure |
| Route not found | Missing corresponding file in `templates/` | Create a `.ts` file matching `route.template` |

---

## 15. Complete Theme Example

Below is a minimal but universally‑compliant theme `barebone`.

**Directory Structure**:

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

**`layout.ts`**:

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

**`styles.css`**:

```css
body { font-family: sans-serif; max-width: 960px; margin: 2rem auto; padding: 0 1rem; }
header { border-bottom: 1px solid #ccc; }
```

**`templates/home.ts`**:

```typescript
import { resolveData } from '../partials/utils.js';
export default function(ctx, route, data) {
  const items = resolveData(ctx, data, 'home');
  if (!items.length) return '<p>No content yet.</p>';
  return `<h2>${ctx.config.themeOptions?.home?.title || 'Welcome'}</h2>
    <ul>${items.map(i => `<li><a href="${i.slug}">${i.title}</a></li>`).join('')}</ul>`;
}
```

**`partials/utils.ts`**:

```typescript
export function resolveData(ctx, data, configKey) {
  const opts = ctx.config.themeOptions?.[configKey] || {};
  const ns = opts.namespace || 'content';
  const key = opts.key || 'items';
  return data[ns]?.[key] || [];
}
```

Example user configuration:

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