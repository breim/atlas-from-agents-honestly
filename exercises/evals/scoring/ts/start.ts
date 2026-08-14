import { Unimplemented } from '#harness';

export interface Trial {
  id: string;
  forward: 'a' | 'b';
  reverse: 'a' | 'b';
}

export interface Comparison {
  a: number;
  b: number;
  winner: 'a' | 'b' | 'tie';
  inconsistent: string[];
  consistencyBps: number;
  positionBias: { first: number; second: number };
}

export function compare(trials: Trial[]): Comparison {
  throw new Unimplemented('compare');
}
