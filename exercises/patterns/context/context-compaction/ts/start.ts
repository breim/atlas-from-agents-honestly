import { Unimplemented } from '#harness';

export interface Entry {
  id: string;
  tokens: number;
  pinned: boolean;
}

export interface Compaction {
  kept: string[];
  dropped: string[];
}

export function compact(_entries: Entry[], _budget: number): Compaction {
  throw new Unimplemented('compact');
}
