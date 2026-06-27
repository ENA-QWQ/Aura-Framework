import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { UserConfig, ResolvedConfig } from './context.js';

export async function loadConfig(root: string): Promise<ResolvedConfig> {
    const configPath = resolve(root, 'aura.config.ts');
    let userConfig: Partial<UserConfig> = {};

    try {
        const fileUrl = pathToFileURL(configPath).href;
        const mod = await import(fileUrl);
        userConfig = mod.default || mod;
    } catch (e) {
        console.warn('[Aura] No aura.config.ts found or invalid, using defaults.');
    }

    const resolved: ResolvedConfig = {
        root,
        outDir: resolve(root, userConfig.outDir || 'dist'),
        srcDir: resolve(root, userConfig.srcDir || '.'),
        theme: userConfig.theme || 'default',
        plugins: userConfig.plugins || [],
        site: userConfig.site || { title: 'Aura Site' },
        routes: userConfig.routes || [],
        ...userConfig as any
    };

    return resolved;
}