import { SchemaDefinition, validate } from './schema.js';

export interface SiteConfig { title: string; description?: string; }

export interface RouteBlueprint {
    path: string;
    collection?: string;
    pageType?: string;
}

export interface UserConfig {
    site: SiteConfig;
    theme: string;
    plugins: string[];
    routes: RouteBlueprint[];
    themeOptions?: any;
    [key: string]: any;
}

export interface ResolvedConfig extends UserConfig {
    root: string;
    outDir: string;
    srcDir: string;
    themeOptions: any;
}

export interface CollectionItem { id: string; slug: string; collection: string; metadata: Record<string, any>; content: string; }
export interface Collection { name: string; items: CollectionItem[]; }

export interface Route {
    path: string;
    pageType: string;
    collection?: string;
    data: Record<string, any>;
}

export interface AssetDescriptor { type: 'css' | 'js'; content: string; inject: 'head' | 'body'; filename?: string; pluginName?: string; }

export class DataStore {
    private store = new Map<string, Record<string, any>>();
    set(namespace: string, key: string, value: any, schema?: SchemaDefinition) {
        if (schema && !validate(value, schema)) throw new Error(`Schema validation failed for ${namespace}:${key}`);
        if (!this.store.has(namespace)) this.store.set(namespace, {});
        this.store.get(namespace)![key] = value;
    }
    get(namespace: string, key: string): any { return this.store.get(namespace)?.[key]; }
    getFlat(): Record<string, any> {
        const flat: Record<string, any> = {};
        for (const [ns, data] of this.store.entries()) {
            flat[ns] = data;
        }
        return flat;
    }
}

export class AssetManager {
    private assets: AssetDescriptor[] = [];
    add(type: 'css' | 'js', content: string, inject: 'head' | 'body', filename?: string, pluginName?: string) {
        this.assets.push({ type, content, inject, filename, pluginName });
    }
    getAssets(): AssetDescriptor[] { return this.assets; }
}

export interface AuraContext {
    config: ResolvedConfig;
    collections: Collection[];
    routes: Route[];
    data: DataStore;
    assets: AssetManager;
    components: Map<string, Function>;
    viewRegistry: Map<string, Function>;
}

export class Context implements AuraContext {
    config: ResolvedConfig;
    collections: Collection[] = [];
    routes: Route[] = [];
    data: DataStore = new DataStore();
    assets: AssetManager = new AssetManager();
    components: Map<string, Function> = new Map();
    viewRegistry: Map<string, Function> = new Map();

    constructor(config: ResolvedConfig) {
        this.config = config;
    }
}

export interface PluginModule { name: string; component?: string; }

export interface PluginManifest {
    name: string;
    version?: string;
    enforce?: 'pre' | 'normal' | 'post';
    dependencies?: string[];
    schema?: Record<string, SchemaDefinition>;
    modules?: PluginModule[];
    entry?: { node?: string; browser?: string; styles?: string; };
}

export interface PluginHooks {
    buildStart?: (ctx: AuraContext) => void | Promise<void>;
    loadContent?: (collections: Collection[], ctx: AuraContext) => Collection[] | Promise<Collection[]>;
    fetchData?: (ctx: AuraContext) => Record<string, any> | Promise<Record<string, any>>;
    transformCollections?: (collections: Collection[], ctx: AuraContext) => Collection[] | Promise<Collection[]>;
    generateRoutes?: (routes: Route[], ctx: AuraContext) => Route[] | Promise<Route[]>;
    transformHtml?: (html: string, ctx: AuraContext, route: Route) => string | Promise<string>;
    buildEnd?: (ctx: AuraContext) => void | Promise<void>;
}

export interface LoadedPlugin extends PluginHooks { manifest: PluginManifest; dir: string; }