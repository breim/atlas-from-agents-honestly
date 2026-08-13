import { Unimplemented } from '#harness';

export interface ItemOutcome {
  item: string;
  ok: boolean;
  value: string | null;
}

export interface Collected {
  status: 'complete' | 'partial' | 'failed';
  values: Record<string, string>;
  failed: string[];
  coverage: number;
}

export function collect(_outcomes: ItemOutcome[]): Collected {
  throw new Unimplemented('collect');
}
