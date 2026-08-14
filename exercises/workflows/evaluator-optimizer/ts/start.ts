import { Unimplemented } from '#harness';

export interface Round {
  draft: string;
  score: number;
  feedback: string;
}

export interface Outcome {
  best: string;
  score: number;
  rounds: number;
  stopped: 'converged' | 'stalled' | 'budget';
}

export function optimise(_rounds: Round[], _threshold: number, _maxRounds: number): Outcome {
  throw new Unimplemented('optimise');
}
