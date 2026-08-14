import { Unimplemented } from '#harness';

export interface Step {
  id: string;
  ms: number;
  ok: boolean;
}

export type Mode = 'sequential' | 'parallel' | 'fanout';

export interface Composition {
  results: string[];
  failed: string[];
  elapsed: number;
}

export function compose(_steps: Step[], _mode: Mode, _limit: number): Composition {
  throw new Unimplemented('compose');
}
