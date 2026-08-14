export interface GraphNode {
  id: string;
  tenantId: string;
}

export interface Edge {
  from: string;
  to: string;
}

export function traverse(
  start: string,
  nodes: GraphNode[],
  edges: Edge[],
  maxHops: number,
  tenantId: string,
): string[] {
  const visible = new Set(
    nodes.filter((node) => node.tenantId === tenantId).map((node) => node.id),
  );
  if (!visible.has(start)) return [];

  const visited = [start];
  const seen = new Set(visited);
  let frontier = [start];

  for (let hop = 0; hop < maxHops; hop += 1) {
    const next: string[] = [];
    for (const edge of edges) {
      // The predicate gates the walk, so nothing beyond a foreign node is reachable.
      if (!frontier.includes(edge.from) || seen.has(edge.to) || !visible.has(edge.to)) continue;
      seen.add(edge.to);
      visited.push(edge.to);
      next.push(edge.to);
    }
    if (next.length === 0) break;
    frontier = next;
  }

  return visited;
}
