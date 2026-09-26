#!/usr/bin/env node
import { register } from 'tsx/esm/api';

register();

async function main() {
    const { resolve } = await import('path');
    const { runBuild } = await import('./core/pipeline.js');

    const args = process.argv.slice(2);
    const command = args[0];
    const rootIndex = args.indexOf('--root');

    let root = process.cwd();
    if (rootIndex !== -1) {
        const rootValue = args[rootIndex + 1];
        if (!rootValue || rootValue.startsWith('--')) {
            console.error('[Aura] Missing value for --root');
            process.exit(1);
        }
        root = resolve(rootValue);
    }

    if (command === 'build') {
        await runBuild(root);
    } else {
        console.log('Usage: aura build [--root <path>]');
        process.exit(1);
    }
}

main().catch(err => {
    console.error('[Aura] Fatal error:', err);
    process.exit(1);
});