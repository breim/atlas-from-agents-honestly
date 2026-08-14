import { Unimplemented } from '#harness';

export interface Predicate {
  field: string;
  equals?: unknown;
  atLeast?: number;
}

export interface Router {
  from: string;
  destinations: string[];
  branches: Array<{ when: Predicate; to: string }>;
  otherwise?: string;
  fanOut?: string[];
  join?: string;
}

export interface Node {
  name: string;
  kind: 'node' | 'subgraph';
  graph?: string;
  mode?: 'shared' | 'transformed';
  passes?: string[];
  returns?: string[];
}

export interface Graph {
  entry: string;
  loop: { bound: number; superStepsPerPass: number } | null;
  reducers: Record<string, 'sum' | 'concat'>;
  nodes: Node[];
  edges: Array<{ from: string; to: string }>;
  routers: Router[];
}

export type State = Record<string, unknown>;

export interface Config {
  transcriptFields: string[];
  backstop: number;
}

export interface View {
  node: string;
  saw: string[];
  returned: string[];
}

export interface Run {
  status: 'completed' | 'halted' | 'crashed' | 'invalid';
  errors: string[];
  path: string[];
  superSteps: number;
  state: State;
  views: View[];
}

export function run(
  graph: Graph,
  input: State,
  updates: Record<string, State[]>,
  subUpdates: Record<string, State[]>,
  config: Config,
): Run {
  throw new Unimplemented('run');
}
