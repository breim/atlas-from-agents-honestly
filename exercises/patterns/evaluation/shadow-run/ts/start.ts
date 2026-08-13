import { Unimplemented } from '#harness';

export interface Exchange {
  id: string;
  production: string;
  candidate: string | null;
}

export interface Shadow {
  served: Record<string, string>;
  divergences: Exchange[];
  agreement: number;
}

export function shadow(_traffic: Exchange[]): Shadow {
  throw new Unimplemented('shadow');
}
