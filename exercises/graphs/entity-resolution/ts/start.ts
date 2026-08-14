import { Unimplemented } from '#harness';

export interface Pair {
  a: string;
  b: string;
  score: number;
}

export function resolve(_records: string[], _pairs: Pair[], _threshold: number): string[][] {
  throw new Unimplemented('resolve');
}
