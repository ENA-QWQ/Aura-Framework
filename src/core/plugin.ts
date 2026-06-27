import { readdir, stat, readFile } from 'fs/promises';
import { join, dirname, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { AuraContext, LoadedPlugin, PluginManifest, PluginHooks, ResolvedConfig } from './context.js';
import { topologicalSort, PluginNode } from './graph.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const frameworkRoot = resolve(__dirname, '../../');

export async function discoverAndLoadPlugins(config: ResolvedConfig): Promise<LoadedPlugin[]> {
    const pluginsDir = join(frameworkRoot, 'plugins');
    const loaded: LoadedPlugin[] = [];
    try {
        await stat(pluginsDir);
    } catch {
        return loaded;
    }

    const entries = await readdir(pluginsDir, { withFileTypes: true });

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const pluginDir = join(pluginsDir, entry.name);
        const manifestPath = join(pluginDir, 'manifest.json');

        try {
            const manifestRaw = await readFile(manifestPath, 'utf-8');
            const manifest: PluginManifest = JSON.parse(manifestRaw);

            if (!config.plugins.includes(manifest.name)) {
                continue;
            }

            let hooks: PluginHooks = {};
            if (manifest.entry?.node) {
                const nodePath = join(pluginDir, manifest.entry.node);
                try {
                    const nodeMod = await import(pathToFileURL(nodePath).href);
                    hooks = nodeMod.default || nodeMod;
                } catch (e) {
                    console.error(`[Aura] Failed to load node entry for ${manifest.name}:`, e);
                }
            }

            loaded.push({
                manifest,
                dir: pluginDir,
                ...hooks
            });
        } catch (e) {
            console.error(`[Aura] Failed to load plugin ${entry.name}:`, e);
        }
    }

    const nodes: PluginNode[] = loaded.map(p => ({
        name: p.manifest.name,
        enforce: p.manifest.enforce || 'normal',
        dependencies: p.manifest.dependencies || []
    }));

    const sortedNodes = topologicalSort(nodes);
    const sortedPlugins: LoadedPlugin[] = [];

    for (const node of sortedNodes) {
        const plugin = loaded.find(p => p.manifest.name === node.name);
        if (plugin) sortedPlugins.push(plugin);
    }

    return sortedPlugins;
}

export async function runHook<K extends keyof PluginHooks>(
    plugins: LoadedPlugin[],
    hookName: K,
    ctx: AuraContext,
    initialPayload?: any,
    extraArgs: any[] = []
): Promise<any> {
    let payload = initialPayload;

    if (hookName === 'fetchData') {
        for (const plugin of plugins) {
            const hook = plugin[hookName];
            if (typeof hook !== 'function') continue;
            try {
                const result = await (hook as Function)(ctx);
                if (result && typeof result === 'object') {
                    for (const [key, value] of Object.entries(result)) {
                        const schema = plugin.manifest.schema?.[key];
                        ctx.data.set(plugin.manifest.name, key, value, schema);
                    }
                }
            } catch (error) {
                console.error(`[Aura Plugin: ${plugin.manifest.name}] Hook "${String(hookName)}" failed:`, error);
            }
        }
        return payload;
    }

    for (const plugin of plugins) {
        const hook = plugin[hookName];
        if (typeof hook !== 'function') continue;

        try {
            const isWaterfall = hookName === 'transformHtml' || hookName === 'transformCollections' || hookName === 'loadContent' || hookName === 'generateRoutes';
            let result;
            if (isWaterfall) {
                result = await (hook as Function)(payload, ctx, ...extraArgs);
            } else {
                result = await (hook as Function)(ctx);
            }

            if (result !== undefined) payload = result;
        } catch (error) {
            console.error(`[Aura Plugin: ${plugin.manifest.name}] Hook "${String(hookName)}" failed:`, error);
        }
    }

    return payload;
}