import { Unimplemented } from '#harness';

export interface Round {
  draft: string;
  score: number;
}

export interface Outcome {
  draft: string;
  score: number;
  rounds: number;
  stopped: 'threshold' | 'budget';
}

export function reflect(_rounds: Round[], _threshold: number, _maxRounds: number): Outcome {
  throw new Unimplemented('reflect');
}
