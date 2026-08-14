import { Unimplemented } from '#harness';

export interface Predicate {
  field: string;
  equals?: unknown;
  atLeast?: number;
}

export interface Branch {
  when: Predicate;
  to: string;
}

export interface ConditionalEdge {
  from: string;
  branches: Branch[];
  otherwise: string;
}

export interface Spec {
  entry: string;
  nodes: Array<{ name: string; kind: 'model' | 'code' }>;
  edges: Array<{ from: string; to: string }>;
  conditionalEdges: ConditionalEdge[];
}

export type State = Record<string, unknown>;

export interface Limits {
  maxSteps: number;
}

export interface Run {
  status: 'completed' | 'halted' | 'invalid';
  errors: string[];
  path: string[];
  position: string;
  state: State;
}

export function execute(spec: Spec, input: State, updates: Record<string, State[]>, limits: Limits): Run {
  throw new Unimplemented('execute');
}
