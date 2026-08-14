import { Unimplemented } from '#harness';

export interface Runs {
  semantic: string[];
  lexical: string[];
  hybrid: string[];
}

export interface Comparison {
  semanticBps: number;
  lexicalBps: number;
  hybridBps: number;
  verdict: 'gain' | 'no_gain' | 'regression';
}

export function compare(_runs: Runs, _relevant: string[], _k: number): Comparison {
  throw new Unimplemented('compare');
}
