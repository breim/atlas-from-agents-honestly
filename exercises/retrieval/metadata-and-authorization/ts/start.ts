import { Unimplemented } from '#harness';

export interface Chunk {
  id: number;
  documentId: string;
  version: number;
  tenantId: string | null;
  acl: string[];
  embedding: number;
  supersededAt: string | null;
}

export interface Index {
  probe: number;
  chunks: Chunk[];
  liveAcls: Record<string, string[]>;
}

export interface Principal {
  id: string;
  tenantId: string;
  groups: string[];
}

export interface Query {
  point: number;
  k: number;
  tenantId?: string;
}

export interface Config {
  enforcement: 'in-query' | 'post';
  lateBinding: boolean;
}

export interface Hit {
  id: number;
  documentId: string;
  version: number;
  distance: number;
}

export interface Retrieval {
  results: Hit[];
  exposed: string[];
  revoked: string[];
  audit: { principalId: string | null; tenantId: string | null; retrieved: string[] };
  errors: string[];
}

export function retrieve(query: Query, principal: Principal | null, index: Index, config: Config): Retrieval {
  throw new Unimplemented('retrieve');
}
