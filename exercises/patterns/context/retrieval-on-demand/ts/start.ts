import { Unimplemented } from '#harness';

export type Turn = { say: string } | { ask: string };

export interface Run {
  fetches: string[];
  results: Array<string | null>;
}

export function run(_turns: Turn[], _corpus: Record<string, string>): Run {
  throw new Unimplemented('run');
}
