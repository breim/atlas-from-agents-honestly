import { Unimplemented } from '#harness';

export interface Watch {
  tripped: boolean;
  at: number | null;
  worstBps: number | null;
}

export function watch(_outcomes: string[], _window: number, _floorBps: number): Watch {
  throw new Unimplemented('watch');
}
