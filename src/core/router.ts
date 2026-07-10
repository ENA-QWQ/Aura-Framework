import { AuraContext, Route } from './context.js';

export async function resolveRoutes(ctx: AuraContext): Promise<Route[]> {
    if (!ctx.config.routes || ctx.config.routes.length === 0) {
        return [{ path: '/', pageType: 'home', data: {} }];
    }

    return ctx.config.routes.map(blueprint => ({
        path: blueprint.path,
        pageType: blueprint.pageType || 'page',
        collection: blueprint.collection,
        data: {}
    }));
}