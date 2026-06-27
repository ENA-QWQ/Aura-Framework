import { AuraContext, Route } from './context.js';

export async function resolveRoutes(ctx: AuraContext): Promise<Route[]> {
    if (!ctx.config.routes || ctx.config.routes.length === 0) {
        return [{ path: '/', template: 'home', modules: [], data: {} }];
    }
    return ctx.config.routes.map(blueprint => ({
        path: blueprint.path,
        template: blueprint.template,
        modules: blueprint.modules || [],
        collection: blueprint.collection,
        pageType: blueprint.pageType,
        data: {}
    }));
}