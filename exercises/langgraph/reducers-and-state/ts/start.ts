import { Unimplemented } from '#harness';

export type State = Record<string, unknown>;

export interface Update {
  channel: string;
  value: unknown;
}

export interface Reduced {
  state: State;
  rejected: string[];
}

export function reduce(
  _state: State,
  _updates: Update[],
  _schema: Record<string, string>,
): Reduced {
  throw new Unimplemented('reduce');
}
