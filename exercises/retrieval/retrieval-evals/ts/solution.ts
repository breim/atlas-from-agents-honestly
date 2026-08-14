export interface Scores {
  recallBps: number;
  precisionBps: number;
  rrBps: number;
}

const bps = (numerator: number, denominator: number): number =>
  denominator === 0 ? 0 : Math.floor((numerator * 10000) / denominator + 0.5);

export function score(retrieved: string[], relevant: string[], k: number): Scores {
  const top = retrieved.slice(0, k);
  const wanted = new Set(relevant);
  const found = top.filter((id) => wanted.has(id));

  const firstHit = top.findIndex((id) => wanted.has(id));

  return {
    // A query with nothing relevant cannot fail to recall it.
    recallBps: relevant.length === 0 ? 10000 : bps(found.length, relevant.length),
    precisionBps: bps(found.length, top.length),
    rrBps: firstHit === -1 ? 0 : bps(1, firstHit + 1),
  };
}
