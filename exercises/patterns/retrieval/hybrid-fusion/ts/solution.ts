export function fuse(rankings: string[][], k: number): string[] {
  const scores = new Map<string, number>();

  for (const ranking of rankings) {
    ranking.forEach((id, index) => {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + index + 1));
    });
  }

  return [...scores.entries()]
    .sort(([idA, scoreA], [idB, scoreB]) => scoreB - scoreA || idA.localeCompare(idB))
    .map(([id]) => id);
}
