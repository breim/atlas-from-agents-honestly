import { Unimplemented } from '#harness';

export interface Block {
  id: string;
  tokens: number;
  hash: string;
}

export interface Pricing {
  input: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface Priced {
  cached: number;
  fresh: number;
  micros: number;
}

export function price(_previous: Block[], _current: Block[], _pricing: Pricing): Priced {
  throw new Unimplemented('price');
}
