import { Unimplemented } from '#harness';

export interface Liveness {
  alive: boolean;
  declaredDeadAt: number | null;
}

export function monitor(
  _startedAt: number,
  _beats: number[],
  _finishedAt: number,
  _timeout: number,
): Liveness {
  throw new Unimplemented('monitor');
}
