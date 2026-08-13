import { Unimplemented } from '#harness';

export interface Action {
  tool: string;
  cents: number;
}

export interface Budget {
  actions: number;
  cents: number;
  tools: string[];
}

export interface Enforcement {
  allowed: string[];
  denied: Array<{ tool: string; reason: string }>;
}

export function enforce(_actions: Action[], _budget: Budget): Enforcement {
  throw new Unimplemented('enforce');
}
