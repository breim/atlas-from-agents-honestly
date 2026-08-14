import { Unimplemented } from '#harness';

export interface Source {
  documentId: string;
  contentHash: string;
  tenantId: string | null;
  version: number | null;
  chunkCount: number;
  parseOk: boolean;
  parseError?: string;
  modifiedAt: string;
}

export interface Chunk {
  id: string;
  documentId: string;
  version: number;
  tenantId: string;
  contentHash: string;
  pipelineVersion: string;
}

export interface Index {
  chunks: Chunk[];
}

export interface Config {
  pipelineVersion: string;
  requiredMetadata: string[];
}

export interface Manifest {
  attempted: number;
  parsed: number;
  failed: Array<{ documentId: string; reason: string }>;
  rejected: Array<{ documentId: string; reason: string }>;
  skipped: string[];
  reindexed: string[];
  tombstoned: string[];
  chunksProduced: number;
  sourceCount: number;
  indexedCount: number;
}

export interface Run {
  chunks: Chunk[];
  manifest: Manifest;
}

export function ingest(sources: Source[], index: Index, config: Config): Run {
  throw new Unimplemented('ingest');
}
