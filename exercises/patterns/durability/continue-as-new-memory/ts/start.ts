import { Unimplemented } from '#harness';

export interface RunState {
  generation: number;
  summary: string[];
  recent: string[];
  events: number;
}

export function run(_events: string[], _maxEvents: number, _keepRecent: number): RunState {
  throw new Unimplemented('run');
}
