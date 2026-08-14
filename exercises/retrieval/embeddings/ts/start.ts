import { Unimplemented } from '#harness';

export interface Vector {
  id: string;
  v: number[];
}

export interface Hit {
  id: string;
  bps: number;
}

export function nearest(_query: number[], _vectors: Vector[], _topK: number): Hit[] {
  throw new Unimplemented('nearest');
}
