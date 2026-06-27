import { resolve } from 'path';
import { runBuild } from './core/pipeline.js';

const args = process.argv.slice(2);
const command = args[0];
const rootIndex = args.indexOf('--root');
const root = rootIndex !== -1 ? resolve(args[rootIndex + 1]) : process.cwd();

if (command === 'build') {
    runBuild(root).catch(err => {
        console.error('[Aura] Fatal error:', err);
        process.exit(1);
    });
} else {
    console.log('Usage: aura build [--root <path>]');
}