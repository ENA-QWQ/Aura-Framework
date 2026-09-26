import { mkdir, writeFile, cp, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { Context } from './context.js';
import { loadConfig } from './config.js';
import { discoverAndLoadPlugins, runHook } from './plugin.js';
import { resolveRoutes } from './router.js';
import { renderRoute } from './renderer.js';

function collectMissingThemeStyles(cssContent: string): string[] {
    const requiredVariables = [
        '--aura-color-primary',
        '--aura-color-text',
        '--aura-color-border',
        '--aura-font-sans',
        '--aura-space-md',
        '--aura-radius-md'
    ];

    const requiredClasses = [
        '.aura-ui-btn',
        '.aura-ui-card',
        '.aura-ui-input',
        '.aura-ui-badge',
        '.aura-ui-typography-h1'
    ];

    const missing: string[] = [];
    for (const v of requiredVariables) {
        if (!cssContent.includes(v)) missing.push(`CSS variable ${v}`);
    }
    for (const c of requiredClasses) {
        if (!cssContent.includes(c)) missing.push(`CSS class ${c}`);
    }
    return missing;
}

export async function runBuild(root: string) {
    console.log('[Aura] Starting build pipeline...');
    const startTime = Date.now();

    const userConfig = await loadConfig(root);
    const ctx = new Context(userConfig);
    const plugins = await discoverAndLoadPlugins(userConfig);

    console.log(`[Aura] Loaded plugins: ${plugins.map(p => p.manifest.name).join(', ') || 'none'}`);

    await runHook(plugins, 'buildStart', ctx);

    ctx.collections = (await runHook(plugins, 'loadContent', ctx, [])) || [];
    ctx.collections =
        (await runHook(plugins, 'transformCollections', ctx, ctx.collections)) || ctx.collections;

    await runHook(plugins, 'fetchData', ctx);

    ctx.routes = await resolveRoutes(ctx);
    ctx.routes = (await runHook(plugins, 'generateRoutes', ctx, ctx.routes)) || ctx.routes;

    const themeDir = join(ctx.config.srcDir, 'themes', ctx.config.theme);
    const themeStylesPath = join(themeDir, 'styles.css');

    let themeStyles: string;
    try {
        themeStyles = await readFile(themeStylesPath, 'utf-8');
    } catch (e) {
        throw new Error(`[Aura] Theme styles not found: ${themeStylesPath}`);
    }

    const missing = collectMissingThemeStyles(themeStyles);
    if (missing.length > 0) {
        console.warn('[Aura] Theme styles validation warnings:');
        for (const m of missing) {
            console.warn(`  - Missing ${m}`);
        }
    }

    ctx.assets.add('css', themeStyles, 'head', 'theme.css', 'theme');

    for (const plugin of plugins) {
        const entry = plugin.manifest.entry;
        if (!entry) continue;

        const pluginDistDir = join(ctx.config.outDir, 'assets', 'plugins', plugin.manifest.name);
        await mkdir(pluginDistDir, { recursive: true });

        if (entry.styles) {
            const srcFile = join(plugin.dir, entry.styles);
            try {
                const content = await readFile(srcFile, 'utf-8');
                const filename = entry.styles.split('/').pop()!;
                ctx.assets.add('css', content, 'head', filename, plugin.manifest.name);
                await writeFile(join(pluginDistDir, filename), content);
            } catch (e) {
                console.warn(`[Aura] Plugin styles not found: ${srcFile}`);
            }
        }

        if (entry.browser) {
            const srcFile = join(plugin.dir, entry.browser);
            try {
                const content = await readFile(srcFile, 'utf-8');
                const filename = entry.browser.split('/').pop()!;
                ctx.assets.add('js', content, 'body', filename, plugin.manifest.name);
                await writeFile(join(pluginDistDir, filename), content);
            } catch (e) {
                console.warn(`[Aura] Plugin browser entry not found: ${srcFile}`);
            }
        }
    }

    await mkdir(ctx.config.outDir, { recursive: true });

    const publicDir = join(ctx.config.srcDir, 'public');
    try {
        await cp(publicDir, ctx.config.outDir, { recursive: true });
    } catch (e) {
    }

    for (const route of ctx.routes) {
        try {
            const normalized = route.path.replace(/^\/+/, '');

            if (normalized.split('/').some(seg => seg === '..')) {
                console.error(`[Aura] Skipping unsafe route path: ${route.path}`);
                continue;
            }

            let html = await renderRoute(route, ctx);
            html = (await runHook(plugins, 'transformHtml', ctx, html, [route])) || html;

            const outPath = normalized === ''
                ? join(ctx.config.outDir, 'index.html')
                : join(ctx.config.outDir, normalized, 'index.html');

            await mkdir(dirname(outPath), { recursive: true });
            await writeFile(outPath, html, 'utf-8');
            console.log(`[Aura] Generated: ${outPath}`);
        } catch (error) {
            console.error(`[Aura] Failed to render route ${route.path}:`, error);
        }
    }

    await runHook(plugins, 'buildEnd', ctx);

    console.log(`[Aura] Build completed in ${Date.now() - startTime}ms.`);
}