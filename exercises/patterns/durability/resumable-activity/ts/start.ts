import { Unimplemented } from '#harness';

export interface Attempt {
  ok: boolean;
  processed: string[];
  checkpoint: string | null;
}

export function process(
  _items: string[],
  _checkpoint: string | null,
  _failAt: string | null,
): Attempt {
  throw new Unimplemented('process');
}
