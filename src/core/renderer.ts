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

function mergeSlots(base: Record<string, any>, override: Record<string, any>): Record<string, any> {
    const merged: Record<string, any> = { ...base };
    for (const [key, value] of Object.entries(override)) {
        if (value === null) {
            delete merged[key];
            continue;
        }
        const existing = merged[key];
        merged[key] = existing && typeof existing === 'object' && value && typeof value === 'object'
            ? { ...existing, ...value }
            : value;
    }
    return merged;
}

function resolveSlotData(slotConfig: any, bindings: Record<string, any>, ctx: AuraContext, route: Route, slotName: string): any {
    if (slotConfig.binding) {
        return resolveBinding(bindings[slotConfig.binding], ctx);
    }
    if (slotConfig.source) {
        const src = slotConfig.source;
        if (src === 'route.data' || src === 'route' || src === '.') {
            return route.data;
        }
        return resolvePath(route.data, src);
    }
    if (slotName === 'main') {
        return route.data;
    }
    return undefined;
}

async function renderSlot(
    slotConfig: any,
    slotName: string,
    ctx: AuraContext,
    route: Route,
    themeDir: string,
    bindings: Record<string, any>
): Promise<string> {
    let childrenHtml = '';
    if (Array.isArray(slotConfig.children) && slotConfig.children.length > 0) {
        const parts: string[] = [];
        for (let i = 0; i < slotConfig.children.length; i++) {
            const child = slotConfig.children[i];
            const childName = `${slotName}.children[${i}]`;
            const html = await renderSlot(child, childName, ctx, route, themeDir, bindings);
            if (html) parts.push(html);
        }
        childrenHtml = parts.join('\n');
    }

    const viewName = slotConfig.view;

    if (!viewName) {
        return childrenHtml;
    }

    let viewFn: Function | undefined = ctx.viewRegistry.get(viewName);

    if (!viewFn) {
        viewFn = await loadModuleFunction(join(themeDir, 'views', viewName));
    }

    if (!viewFn) {
        if (childrenHtml) return childrenHtml;
        viewFn = await loadModuleFunction(join(themeDir, 'views', 'list'));
    }

    if (!viewFn) {
        return childrenHtml;
    }

    const data = resolveSlotData(slotConfig, bindings, ctx, route, slotName);

    try {
        const html = await viewFn(data, ctx, slotConfig.props || {}, childrenHtml);
        return typeof html === 'string' ? html : childrenHtml;
    } catch (e) {
        console.error(`[Aura] View "${viewName}" failed in slot "${slotName}":`, e);
        return childrenHtml;
    }
}

export async function renderRoute(route: Route, ctx: AuraContext): Promise<string> {
    const themeDir = join(ctx.config.srcDir, 'themes', ctx.config.theme);
    const themeOptions = ctx.config.themeOptions || {};
    const layouts = themeOptions.layouts || {};
    const bindings = themeOptions.bindings || {};
    const baseSlots: Record<string, any> = { ...(themeOptions.slots || {}) };
    const pageSlots: Record<string, any> =
        (themeOptions.slotsByPageType && themeOptions.slotsByPageType[route.pageType]) || {};
    const slotsConfig: Record<string, any> = mergeSlots(baseSlots, pageSlots);

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
        slotsHtml[slotName] = await renderSlot(slotConfig, slotName, ctx, route, themeDir, bindings);
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