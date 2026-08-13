import { Unimplemented } from '#harness';

export interface Request {
  at: number;
  prefix: string;
  prefixTokens: number;
}

export interface Replay {
  hits: number[];
  misses: number[];
  hitRateBps: number;
}

export function replay(_requests: Request[], _minCacheTokens: number, _ttlMs: number): Replay {
  throw new Unimplemented('replay');
}
