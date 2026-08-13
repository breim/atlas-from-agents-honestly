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

/** floor(x + 0.5) rather than the language's round, so both tracks agree on halves. */
const toFourPlaces = (ratio: number): number => Math.floor(ratio * 10000 + 0.5) / 10000;

export function collect(outcomes: ItemOutcome[]): Collected {
  const succeeded = outcomes.filter((outcome) => outcome.ok);
  const failed = outcomes.filter((outcome) => !outcome.ok).map((outcome) => outcome.item);

  const status =
    failed.length === 0 ? 'complete' : succeeded.length === 0 ? 'failed' : 'partial';

  return {
    status,
    values: Object.fromEntries(succeeded.map((outcome) => [outcome.item, outcome.value!])),
    failed,
    coverage: outcomes.length === 0 ? 1 : toFourPlaces(succeeded.length / outcomes.length),
  };
}
