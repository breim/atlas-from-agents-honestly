import { Unimplemented } from '#harness';

export interface Field {
  name: string;
  tokens: number;
  essential: boolean;
}

export interface Shaped {
  kept: string[];
  dropped: string[];
  tokens: number;
  fits: boolean;
}

export function shape(_present: string[], _spec: Field[], _budget: number): Shaped {
  throw new Unimplemented('shape');
}
