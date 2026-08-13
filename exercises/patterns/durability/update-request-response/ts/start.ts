import { Unimplemented } from '#harness';

export interface State {
  status: 'open' | 'closed';
  creditCents: number;
}

export interface Update {
  kind: string;
  cents: number;
}

export type Response = { ok: true; value: number } | { ok: false; error: string };

export interface Applied {
  state: State;
  responses: Response[];
}

export function applyUpdates(_initial: State, _updates: Update[]): Applied {
  throw new Unimplemented('applyUpdates');
}
