export type Turn = { say: string } | { ask: string };

export interface Run {
  fetches: string[];
  results: Array<string | null>;
}

const isAsk = (turn: Turn): turn is { ask: string } => 'ask' in turn;

export function run(turns: Turn[], corpus: Record<string, string>): Run {
  const fetches: string[] = [];
  const cache = new Map<string, string | null>();
  const results: Array<string | null> = [];

  for (const turn of turns) {
    if (!isAsk(turn)) {
      results.push(turn.say);
      continue;
    }

    if (!cache.has(turn.ask)) {
      fetches.push(turn.ask);
      cache.set(turn.ask, corpus[turn.ask] ?? null);
    }
    results.push(cache.get(turn.ask)!);
  }

  return { fetches, results };
}
