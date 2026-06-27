import { join } from 'path';
import { pathToFileURL } from 'url';
import { AuraContext, Route } from './context.js';

const RUNTIME_BUS = `<script>window.AuraBus={_e:{},on:function(k,fn){(this._e[k]=this._e[k]||[]).push(fn);},emit:function(k,d){(this._e[k]||[]).forEach(fn=>fn(d));}};</script>`;

export async function renderRoute(route: Route, ctx: AuraContext): Promise<string> {
    const themeDir = join(ctx.config.srcDir, 'themes', ctx.config.theme);
    const templatePath = join(themeDir, 'templates', `${route.template}.ts`);
    let pageHtml = '';

    try {
        const templateMod = await import(pathToFileURL(templatePath).href);
        const renderTemplate = templateMod.default || templateMod.render;
        if (typeof renderTemplate === 'function') {
            const flatData = ctx.data.getFlat();
            pageHtml = await renderTemplate(ctx, route, flatData);
        }
    } catch (e) {
        console.error(`[Aura] Template "${route.template}" not found or invalid.`);
        pageHtml = `<h1>Template Error</h1>`;
    }

    const layoutPath = join(themeDir, 'layout.ts');
    try {
        const layoutMod = await import(pathToFileURL(layoutPath).href);
        const renderLayout = layoutMod.default || layoutMod.render;
        if (typeof renderLayout === 'function') {
            pageHtml = await renderLayout(ctx, pageHtml, route);
        }
    } catch (e) {
        console.warn(`[Aura] Layout not found for theme ${ctx.config.theme}`);
    }

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