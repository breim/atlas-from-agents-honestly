import { Unimplemented } from '#harness';

export interface Doc {
  id: string;
  terms: string[];
}

export interface Hit {
  id: string;
  score: number;
}

export function search(
  _query: string[],
  _docs: Doc[],
  _idf: Record<string, number>,
  _topK: number,
): Hit[] {
  throw new Unimplemented('search');
}
