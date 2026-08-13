import { Unimplemented } from '#harness';

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

export function search(_chunks: Chunk[], _filter: Filter, _topK: number): string[] {
  throw new Unimplemented('search');
}
