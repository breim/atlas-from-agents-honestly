import { Unimplemented } from '#harness';

export interface Block {
  id: string;
  kind: string;
  level?: number;
  tokens: number;
  text: string;
}

export interface Document {
  documentId: string;
  version: number;
  blocks: Block[];
}

export interface Config {
  maxChildTokens: number;
  neverStartsAChunk: string[];
  strategy: 'structural' | 'fixed';
}

export interface Parent {
  id: string;
  documentId: string;
  version: number;
  trail: string[];
  tokens: number;
  blockIds: string[];
}

export interface Child extends Parent {
  parentId: string;
}

export interface Chunked {
  parents: Parent[];
  children: Child[];
}

export function chunk(document: Document, config: Config): Chunked {
  throw new Unimplemented('chunk');
}
