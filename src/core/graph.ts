export interface PluginNode {
    name: string;
    enforce: 'pre' | 'normal' | 'post';
    dependencies: string[];
}

export function topologicalSort(nodes: PluginNode[]): PluginNode[] {
    const weight = { pre: 0, normal: 1, post: 2 };
    nodes.sort((a, b) => weight[a.enforce] - weight[b.enforce]);

    const graph = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    for (const node of nodes) {
        graph.set(node.name, []);
        inDegree.set(node.name, 0);
    }

    for (const node of nodes) {
        for (const dep of node.dependencies) {
            if (!graph.has(dep)) throw new Error(`Plugin ${node.name} depends on unknown plugin ${dep}`);
            graph.get(dep)!.push(node.name);
            inDegree.set(node.name, (inDegree.get(node.name) || 0) + 1);
        }
    }

    const queue: string[] = [];
    for (const node of nodes) {
        if (inDegree.get(node.name) === 0) queue.push(node.name);
    }

    const sorted: PluginNode[] = [];
    const nodeMap = new Map(nodes.map(n => [n.name, n]));

    while (queue.length > 0) {
        const current = queue.shift()!;
        sorted.push(nodeMap.get(current)!);
        for (const neighbor of graph.get(current)!) {
            inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
            if (inDegree.get(neighbor) === 0) queue.push(neighbor);
        }
    }

    if (sorted.length !== nodes.length) throw new Error('Circular dependency detected in plugins');
    return sorted;
}