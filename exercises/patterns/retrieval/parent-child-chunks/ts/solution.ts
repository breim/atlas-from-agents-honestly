export interface Chunk {
  id: string;
  parentId: string | null;
  text: string;
}

export function expand(hits: string[], chunks: Chunk[], parents: Record<string, string>): string[] {
  const byId = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  const seen = new Set<string>();
  const out: string[] = [];

  for (const hit of hits) {
    const chunk = byId.get(hit);
    if (!chunk) continue;

    const key = chunk.parentId ?? chunk.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(chunk.parentId ? parents[chunk.parentId] : chunk.text);
  }

  return out;
}
