import { Unimplemented } from '#harness';

export interface Turn {
  id: string;
  tokens: number;
  facts: string[];
}

export interface Compaction {
  kept: string[];
  summarised: string[];
  tokens: number;
  fits: boolean;
}

export function compact(_turns: Turn[], _budget: number, _costPerFact: number): Compaction {
  throw new Unimplemented('compact');
}
