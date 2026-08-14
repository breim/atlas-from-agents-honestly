export interface Vector {
  id: string;
  v: number[];
}

export interface Hit {
  id: string;
  bps: number;
}

const norm = (v: number[]): number => Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));

export function nearest(query: number[], vectors: Vector[], topK: number): Hit[] {
  const queryNorm = norm(query);
  if (queryNorm === 0) return [];

  return vectors
    .filter((vector) => norm(vector.v) > 0)
    .map((vector) => {
      const dot = vector.v.reduce((sum, x, i) => sum + x * query[i], 0);
      return { id: vector.id, bps: Math.floor((dot / (norm(vector.v) * queryNorm)) * 10000 + 0.5) };
    })
    .sort((a, b) => b.bps - a.bps || a.id.localeCompare(b.id))
    .slice(0, topK);
}
