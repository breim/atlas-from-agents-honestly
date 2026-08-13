import { Unimplemented } from '#harness';

export interface State {
  summary: string[];
  recent: string[];
}

export function append(_state: State, _turnId: string, _keepRecent: number): State {
  throw new Unimplemented('append');
}
