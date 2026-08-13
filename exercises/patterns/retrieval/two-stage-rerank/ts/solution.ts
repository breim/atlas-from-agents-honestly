export interface Candidate {
  id: string;
  cheap: number;
  precise: number;
}

const byScore = (score: (candidate: Candidate) => number) => (a: Candidate, b: Candidate) =>
  score(b) - score(a) || a.id.localeCompare(b.id);

export function rerank(candidates: Candidate[], shortlist: number, topK: number): string[] {
  return [...candidates]
    .sort(byScore((candidate) => candidate.cheap))
    .slice(0, shortlist)
    .sort(byScore((candidate) => candidate.precise))
    .slice(0, topK)
    .map((candidate) => candidate.id);
}
