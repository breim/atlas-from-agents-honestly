export interface Pair {
  a: string;
  b: string;
  score: number;
}

export function resolve(records: string[], pairs: Pair[], threshold: number): string[][] {
  // A cluster is a connected component, so transitivity comes with the union.
  const parent = new Map(records.map((id) => [id, id]));

  const find = (id: string): string => {
    while (parent.get(id) !== id) id = parent.get(id)!;
    return id;
  };

  for (const pair of pairs) {
    if (pair.score < threshold) continue;
    parent.set(find(pair.a), find(pair.b));
  }

  const clusters = new Map<string, string[]>();
  for (const id of records) {
    const root = find(id);
    clusters.set(root, [...(clusters.get(root) ?? []), id]);
  }

  return [...clusters.values()]
    .map((cluster) => [...cluster].sort())
    .sort((a, b) => a[0].localeCompare(b[0]));
}
