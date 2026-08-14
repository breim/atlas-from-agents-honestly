import { Unimplemented } from '#harness';

export interface Chunk {
  id: number;
  documentId: string;
  version: number;
  supersededAt: string | null;
  tier: string;
  region: string;
  tenantId: string;
  embedding: number;
}

export interface Index {
  probe: number;
  chunks: Chunk[];
  strategy: 'post' | 'pre' | 'in-algorithm';
}

export interface Query {
  point: number;
}

export type Filters = Partial<Pick<Chunk, 'tier' | 'region' | 'tenantId'>>;

export interface Hit {
  id: number;
  documentId: string;
  version: number;
  distance: number;
}

export interface Search {
  strategy: Index['strategy'];
  results: Hit[];
  scanned: number;
  filtered: number;
  shortfall: number;
}

export function search(query: Query, filters: Filters, k: number, index: Index): Search {
  throw new Unimplemented('search');
}
