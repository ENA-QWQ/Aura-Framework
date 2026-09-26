import { join } from 'path';
import { pathToFileURL } from 'url';
import { AuraContext, Route } from './context.js';
import { resolveBinding, resolvePath } from './utils.js';

const RUNTIME_BUS = `<script>window.AuraBus={_e:{},on:function(k,fn){(this._e[k]=this._e[k]||[]).push(fn);},emit:function(k,d){(this._e[k]||[]).forEach(fn=>fn(d));}};</script>`;

async function loadModuleFunction(basePath: string): Promise<Function | undefined> {
    const candidates = [`${basePath}.ts`, `${basePath}.js`];
    for (const candidate of candidates) {
        try {
            const mod = await import(pathToFileURL(candidate).href);
            const fn = mod.default || mod.render;
            if (typeof fn === 'function') return fn;
        } catch (e) {
        }
    }
    return undefined;
}

export async function renderRoute(route: Route, ctx: AuraContext): Promise<string> {
    const themeDir = join(ctx.config.srcDir, 'themes', ctx.config.theme);
    const themeOptions = ctx.config.themeOptions || {};
    const layouts = themeOptions.layouts || {};
    const bindings = themeOptions.bindings || {};
    const slotsConfig: Record<string, any> = { ...(themeOptions.slots || {}) };

    if (!slotsConfig['main']) {
        slotsConfig['main'] = { view: 'page' };
    }

    const layoutName = layouts[route.pageType] || layouts['default'] || 'single';
    const layoutPath = join(themeDir, 'layouts', layoutName);

    let layoutFn = await loadModuleFunction(layoutPath);
    if (!layoutFn) {
        console.warn(`[Aura] Layout "${layoutName}" not found for theme "${ctx.config.theme}", using fallback.`);
        layoutFn = async (_ctx: AuraContext, slotsHtml: Record<string, string>) =>
            `<!DOCTYPE html><html><head></head><body>${Object.values(slotsHtml).join('')}</body></html>`;
    }

    const slotsHtml: Record<string, string> = {};

    for (const [slotName, slotConfig] of Object.entries(slotsConfig)) {
        let data: any;

        if (slotConfig.binding) {
            const bindingConfig = bindings[slotConfig.binding];
            data = resolveBinding(bindingConfig, ctx);
        } else if (slotConfig.source) {
            data = resolvePath(route.data, slotConfig.source);
        } else if (slotName === 'main') {
            data = route.data;
        }

        const viewName = slotConfig.view;
        let viewFn: Function | undefined = viewName
            ? ctx.viewRegistry.get(viewName)
            : undefined;

        if (!viewFn && viewName) {
            viewFn = await loadModuleFunction(join(themeDir, 'views', viewName));
        }

        if (!viewFn) {
            viewFn = await loadModuleFunction(join(themeDir, 'views', 'list'));
        }

        if (!viewFn) {
            slotsHtml[slotName] = '';
            continue;
        }

        try {
            const html = await viewFn(data, ctx, slotConfig.props || {});
            slotsHtml[slotName] = typeof html === 'string' ? html : '';
        } catch (e) {
            console.error(`[Aura] View "${viewName}" failed in slot "${slotName}":`, e);
            slotsHtml[slotName] = '';
        }
    }

    let pageHtml = await layoutFn(ctx, slotsHtml, route);

    let headInjections = RUNTIME_BUS;
    let bodyInjections = '';

    for (const asset of ctx.assets.getAssets()) {
        const link = asset.filename && asset.pluginName
            ? `/assets/plugins/${asset.pluginName}/${asset.filename}`
            : null;

        if (asset.inject === 'head') {
            if (asset.type === 'css') {
                headInjections += `\n<style>\n${asset.content}\n</style>`;
            } else if (link) {
                headInjections += `\n<script type="module" src="${link}"></script>`;
            } else {
                headInjections += `\n<script type="module">\n${asset.content}\n</script>`;
            }
        } else {
            if (asset.type === 'css') {
                bodyInjections += `\n<style>\n${asset.content}\n</style>`;
            } else if (link) {
                bodyInjections += `\n<script type="module" src="${link}"></script>`;
            } else {
                bodyInjections += `\n<script type="module">\n${asset.content}\n</script>`;
            }
        }
    }

    if (headInjections) {
        if (pageHtml.includes('</head>')) {
            pageHtml = pageHtml.replace('</head>', `${headInjections}\n</head>`);
        } else if (pageHtml.includes('<body')) {
            pageHtml = pageHtml.replace('<body', `${headInjections}\n<body`);
        } else {
            pageHtml = headInjections + pageHtml;
        }
    }

    if (bodyInjections) {
        if (pageHtml.includes('</body>')) {
            pageHtml = pageHtml.replace('</body>', `${bodyInjections}\n</body>`);
        } else {
            pageHtml = pageHtml + bodyInjections;
        }
    }

    return pageHtml;
}