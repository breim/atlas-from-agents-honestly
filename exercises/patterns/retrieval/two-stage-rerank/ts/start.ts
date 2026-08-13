import { Unimplemented } from '#harness';

export interface Candidate {
  id: string;
  cheap: number;
  precise: number;
}

export function rerank(_candidates: Candidate[], _shortlist: number, _topK: number): string[] {
  throw new Unimplemented('rerank');
}
