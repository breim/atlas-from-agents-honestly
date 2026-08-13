import { Unimplemented } from '#harness';

export interface Batch {
  batch: string[];
  cursor: string | null;
  done: boolean;
}

export function nextBatch(_items: string[], _size: number, _cursor: string | null): Batch {
  throw new Unimplemented('nextBatch');
}
