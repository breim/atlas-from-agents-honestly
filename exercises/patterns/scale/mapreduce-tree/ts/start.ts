import { Unimplemented } from '#harness';

export interface Reduction {
  result: string | null;
  levels: string[][];
}

export function reduceTree(_items: string[], _fanIn: number): Reduction {
  throw new Unimplemented('reduceTree');
}
