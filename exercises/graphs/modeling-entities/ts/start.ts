import { Unimplemented } from '#harness';

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

export function validate(_graph: Graph, _ontology: Ontology): Validation {
  throw new Unimplemented('validate');
}
