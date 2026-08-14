import { Unimplemented } from '#harness';

export interface Scores {
  recallBps: number;
  precisionBps: number;
  rrBps: number;
}

export function score(_retrieved: string[], _relevant: string[], _k: number): Scores {
  throw new Unimplemented('score');
}
