export interface ItemResult {
  item: string;
  ok: boolean;
}

export interface FanOut {
  results: ItemResult[];
  waves: string[][];
}

export function fanOut(items: string[], limit: number, failures: string[]): FanOut {
  const failing = new Set(failures);
  const waves: string[][] = [];

  for (let start = 0; start < items.length; start += limit) {
    waves.push(items.slice(start, start + limit));
  }

  return {
    results: items.map((item) => ({ item, ok: !failing.has(item) })),
    waves,
  };
}
