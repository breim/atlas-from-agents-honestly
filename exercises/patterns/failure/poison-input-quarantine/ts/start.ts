import { Unimplemented } from '#harness';

export interface Drain {
  processed: string[];
  quarantined: string[];
  attempts: number;
}

export function drain(
  _queue: string[],
  _process: (item: string) => boolean,
  _threshold: number,
): Drain {
  throw new Unimplemented('drain');
}
