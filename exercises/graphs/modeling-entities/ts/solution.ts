export interface Node {
  id: string;
  type: string;
}

export interface Edge {
  from: string;
  type: string;
  to: string;
}

export interface Graph {
  nodes: Node[];
  edges: Edge[];
}

export interface EdgeType {
  name: string;
  from: string;
  to: string;
}

export interface Ontology {
  nodeTypes: string[];
  edgeTypes: EdgeType[];
}

export interface Validation {
  valid: boolean;
  errors: string[];
}

export function validate(graph: Graph, ontology: Ontology): Validation {
  const errors: string[] = [];
  const typeOf = new Map<string, string>();

  for (const node of graph.nodes) {
    if (!ontology.nodeTypes.includes(node.type)) errors.push(`unknown_node_type:${node.id}`);
    if (typeOf.has(node.id)) errors.push(`duplicate_node:${node.id}`);
    else typeOf.set(node.id, node.type);
  }

  for (const edge of graph.edges) {
    const declared = ontology.edgeTypes.find((candidate) => candidate.name === edge.type);
    if (!declared) {
      errors.push(`unknown_edge_type:${edge.type}`);
      continue;
    }

    const missing = [edge.from, edge.to].find((id) => !typeOf.has(id));
    if (missing !== undefined) {
      errors.push(`missing_node:${missing}`);
      continue;
    }

    if (typeOf.get(edge.from) !== declared.from) errors.push(`domain_mismatch:${edge.type}`);
    else if (typeOf.get(edge.to) !== declared.to) errors.push(`range_mismatch:${edge.type}`);
  }

  return { valid: errors.length === 0, errors };
}
