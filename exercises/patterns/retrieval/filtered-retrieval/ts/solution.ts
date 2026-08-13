export interface Chunk {
  id: string;
  tenantId: string;
  score: number;
  tags: string[];
}

export interface Filter {
  tenantId: string;
  requireTags: string[];
}

const allowed = (chunk: Chunk, filter: Filter): boolean =>
  chunk.tenantId === filter.tenantId && filter.requireTags.every((tag) => chunk.tags.includes(tag));

export function search(chunks: Chunk[], filter: Filter, topK: number): string[] {
  return chunks
    .filter((chunk) => allowed(chunk, filter))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, topK)
    .map((chunk) => chunk.id);
}
