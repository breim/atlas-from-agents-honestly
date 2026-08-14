import { Unimplemented } from '#harness';

export interface Chunk {
  id: string;
  provenance: 'first-party' | 'vendor' | 'customer-writable' | 'inferred';
  writers: string[];
  contentHash: string;
  ingestedHash: string;
  competesFor: string[];
}

export interface Task {
  name: string;
  authority: 'high' | 'low';
  query: string;
}

export interface Policy {
  highAuthorityProvenance: string[];
  requireCitations: boolean;
}

export interface Retrieved {
  status: 'served' | 'refused';
  errors: string[];
  chunks: string[];
  tainted: boolean;
  citations: string[];
  competingForQuery: number;
  poisonRatioBps: number;
  drifted: string[];
  writers: string[];
}

export function retrieve(chunks: Chunk[], task: Task, policy: Policy): Retrieved {
  throw new Unimplemented('retrieve');
}
