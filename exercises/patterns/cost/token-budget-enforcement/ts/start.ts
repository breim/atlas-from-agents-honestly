import { Unimplemented } from '#harness';

export interface Call {
  id: string;
  tokens: number;
}

export interface Enforcement {
  executed: string[];
  refused: string[];
  spent: number;
}

export function enforce(_calls: Call[], _budget: number): Enforcement {
  throw new Unimplemented('enforce');
}
