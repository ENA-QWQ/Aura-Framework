import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { existsSync } from 'fs';
import { UserConfig, ResolvedConfig } from './context.js';

export async function loadConfig(root: string): Promise<ResolvedConfig> {
    const configPath = resolve(root, 'aura.config.ts');
    let userConfig: Partial<UserConfig> = {};

    if (existsSync(configPath)) {
        try {
            const fileUrl = pathToFileURL(configPath).href;
            const mod = await import(fileUrl);
            userConfig = mod.default || mod;
        } catch (e) {
            throw new Error(`[Aura] Failed to load aura.config.ts: ${(e as Error).message}`);
        }
    }

    const resolved: ResolvedConfig = {
        ...(userConfig as any),
        root,
        outDir: resolve(root, userConfig.outDir || 'dist'),
        srcDir: resolve(root, userConfig.srcDir || '.'),
        theme: userConfig.theme || 'default',
        plugins: userConfig.plugins || [],
        site: userConfig.site || { title: 'Aura Site' },
        routes: userConfig.routes || [],
        themeOptions: userConfig.themeOptions || {}
    };

    return resolved;
}