import { AuraContext } from './context.js';

export function escapeHtml(value: any): string {
    if (value === undefined || value === null) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function resolvePath(obj: any, path: string): any {
    if (!path) return obj;
    return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

export function resolveBinding(binding: any, ctx: AuraContext): any {
    if (!binding) return undefined;

    const source = binding.source || 'datastore';
    const target = String(binding.target ?? '');

    if (source === 'datastore') {
        const sep = target.indexOf(':');
        if (sep === -1) return undefined;
        const namespace = target.slice(0, sep);
        const key = target.slice(sep + 1);
        return ctx.data.get(namespace, key);
    }

    if (source === 'collection') {
        return ctx.collections.find(c => c.name === target)?.items ?? [];
    }

    return undefined;
}