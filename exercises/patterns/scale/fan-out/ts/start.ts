import { Unimplemented } from '#harness';

export interface ItemResult {
  item: string;
  ok: boolean;
}

export interface FanOut {
  results: ItemResult[];
  waves: string[][];
}

export function fanOut(_items: string[], _limit: number, _failures: string[]): FanOut {
  throw new Unimplemented('fanOut');
}
