export interface Entry {
  id: string;
  tokens: number;
  pinned: boolean;
}

export interface Compaction {
  kept: string[];
  dropped: string[];
}

export function compact(entries: Entry[], budget: number): Compaction {
  const pinnedCost = entries.filter((entry) => entry.pinned).reduce((sum, e) => sum + e.tokens, 0);
  const survivors = new Set(entries.filter((entry) => entry.pinned).map((entry) => entry.id));

  let spent = pinnedCost;
  for (const entry of [...entries].reverse()) {
    if (entry.pinned) continue;
    if (spent + entry.tokens > budget) continue;
    spent += entry.tokens;
    survivors.add(entry.id);
  }

  return {
    kept: entries.filter((entry) => survivors.has(entry.id)).map((entry) => entry.id),
    dropped: entries.filter((entry) => !survivors.has(entry.id)).map((entry) => entry.id),
  };
}
