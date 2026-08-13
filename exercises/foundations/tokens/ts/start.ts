import { Unimplemented } from '#harness';

export interface Usage {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

export type Pricing = Usage;

export function costMicros(_usage: Usage, _pricing: Pricing): number {
  throw new Unimplemented('costMicros');
}
