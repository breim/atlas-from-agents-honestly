import { Unimplemented } from '#harness';

export type Value = string | number;

export interface Step {
  name: string;
  result: Value;
}

export interface Run {
  status: 'completed' | 'crashed' | 'non_determinism';
  results: Value[];
  executed: string[];
  journal: Step[];
}

export function run(program: Step[], journal: Step[], crashAfter: number): Run {
  throw new Unimplemented('run');
}
