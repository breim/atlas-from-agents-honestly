import { Unimplemented } from '#harness';

export interface Rule {
  signal: string;
  store: string;
}

export function route(_signals: string[], _table: Rule[], _fallback: string): string {
  throw new Unimplemented('route');
}
