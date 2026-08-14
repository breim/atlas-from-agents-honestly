import { Unimplemented } from '#harness';

export type Step =
  | { kind: 'effect'; name: string }
  | { kind: 'interrupt'; name: string }
  | { kind: 'subgraph'; name: string; steps: Step[] };

export interface Program {
  steps: Step[];
}

export type Mechanism = 'langgraph' | 'temporal';

export interface Trace {
  effects: string[];
  executions: number;
  duplicated: string[];
}

export function run(program: Program, mechanism: Mechanism): Trace {
  throw new Unimplemented('run');
}
