import { join } from 'path';
import { pathToFileURL } from 'url';
import { AuraContext, Route } from './context.js';

const RUNTIME_BUS = `<script>window.AuraBus={_e:{},on:function(k,fn){(this._e[k]=this._e[k]||[]).push(fn);},emit:function(k,d){(this._e[k]||[]).forEach(fn=>fn(d));}};</script>`;

function resolvePath(obj: any, path: string): any {
    return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

export async function renderRoute(route: Route, ctx: AuraContext): Promise<string> {
    const themeDir = join(ctx.config.srcDir, 'themes', ctx.config.theme);
    const { layouts = {}, slots = {}, bindings = {} } = ctx.config.themeOptions || {};
    const layoutName = layouts[route.pageType] || layouts['default'] || 'single';
    const layoutPath = join(themeDir, 'layouts', `${layoutName}.ts`);

    let layoutFn: Function = async (ctx: AuraContext, slotsHtml: Record<string, string>, route: Route) => {
        return `<html><head></head><body>${Object.values(slotsHtml).join('')}</body></html>`;
    };

    try {
        const layoutMod = await import(pathToFileURL(layoutPath).href);
        const modFn = layoutMod.default || layoutMod.render;
        if (typeof modFn === 'function') layoutFn = modFn;
    } catch (e) {
        console.warn(`[Aura] Layout "${layoutName}" not found for theme ${ctx.config.theme}`);
    }

    const slotsHtml: Record<string, string> = {};
    for (const [slotName, slotConfig] of Object.entries(slots as Record<string, any>)) {
        let data: any = {};

        if (slotConfig.binding) {
            const bindingConfig = bindings[slotConfig.binding];
            if (bindingConfig) {
                const flatData = ctx.data.getFlat();
                data = flatData[bindingConfig.namespace]?.[bindingConfig.key] ?? {};
            }
        } else if (slotConfig.source) {
            data = resolvePath(route.data, slotConfig.source) ?? {};
        }

        const viewName = slotConfig.view;
        let viewFn: Function | undefined = ctx.viewRegistry.get(viewName);

        if (!viewFn) {
            const viewPath = join(themeDir, 'views', `${viewName}.ts`);
            try {
                const viewMod = await import(pathToFileURL(viewPath).href);
                const modFn = viewMod.default || viewMod.render;
                if (typeof modFn === 'function') viewFn = modFn;
            } catch (e) {
                const fallbackViewPath = join(themeDir, 'views', 'list.ts');
                try {
                    const fallbackMod = await import(pathToFileURL(fallbackViewPath).href);
                    const modFn = fallbackMod.default || fallbackMod.render;
                    if (typeof modFn === 'function') viewFn = modFn;
                } catch (err) {
                    viewFn = () => '';
                }
            }
        }

        if (!viewFn) viewFn = () => '';

        slotsHtml[slotName] = await viewFn(data, ctx, slotConfig.props || {});
    }

    let pageHtml = await layoutFn(ctx, slotsHtml, route);

    let headInjections = RUNTIME_BUS;
    let bodyInjections = '';

    for (const asset of ctx.assets.getAssets()) {
        if (asset.inject === 'head') {
            headInjections += asset.type === 'css' ? `\n<style>\n${asset.content}\n</style>` : `\n<script type="module">\n${asset.content}\n</script>`;
        } else {
            if (asset.type === 'css') bodyInjections += `\n<style>\n${asset.content}\n</style>`;
            else if (asset.filename && asset.pluginName) bodyInjections += `\n<script type="module" src="./assets/plugins/${asset.pluginName}/${asset.filename}"></script>`;
            else bodyInjections += `\n<script type="module">\n${asset.content}\n</script>`;
        }
    }

    if (headInjections) pageHtml = pageHtml.replace('</head>', `${headInjections}\n</head>`);
    if (bodyInjections) pageHtml = pageHtml.replace('</body>', `${bodyInjections}\n</body>`);

    return pageHtml;
}