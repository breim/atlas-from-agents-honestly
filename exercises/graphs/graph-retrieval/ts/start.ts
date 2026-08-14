import { Unimplemented } from '#harness';

export interface GraphNode {
  id: string;
  tenantId: string;
}

export interface Edge {
  from: string;
  to: string;
}

export function traverse(
  _start: string,
  _nodes: GraphNode[],
  _edges: Edge[],
  _maxHops: number,
  _tenantId: string,
): string[] {
  throw new Unimplemented('traverse');
}
