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

/** Dropping more turns frees their tokens but adds summary cost, so every prefix is tried. */
function at(turns: Turn[], dropped: number, costPerFact: number): Compaction {
  const kept = turns.slice(dropped);
  const summarised = [...new Set(turns.slice(0, dropped).flatMap((turn) => turn.facts))];
  const tokens =
    kept.reduce((sum, turn) => sum + turn.tokens, 0) + summarised.length * costPerFact;

  return { kept: kept.map((turn) => turn.id), summarised, tokens, fits: true };
}

export function compact(turns: Turn[], budget: number, costPerFact: number): Compaction {
  for (let dropped = 0; dropped <= turns.length; dropped += 1) {
    const candidate = at(turns, dropped, costPerFact);
    if (candidate.tokens <= budget) return candidate;
  }

  return { ...at(turns, turns.length, costPerFact), fits: false };
}
