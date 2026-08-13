import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Candidate, rerank as Rerank } from './start.ts';

interface Case {
  id: string;
  shortlist: number;
  topK: number;
  candidates: Candidate[];
  ranked: string[];
}

const fixture = expected<{ chapter: string; cases: Case[] }>(import.meta.url);
const { rerank } = await loadImpl<{ rerank: typeof Rerank }>(import.meta.url);

const run = (entry: Case) => rerank(entry.candidates, entry.shortlist, entry.topK);

const cases: Array<[string, string]> = [
  ['shortlist-then-rerank', 'the reranker decides the order within the shortlist'],
  ['the-reranker-reorders-the-shortlist', 'a full shortlist is still fully reordered'],
  ['a-document-outside-the-shortlist-cannot-be-rescued', 'stage two never sees what stage one dropped'],
  ['topk-caps-the-output', 'topK trims after reranking, not before'],
  ['a-shortlist-wider-than-the-candidate-set', 'an oversized shortlist is not an index error'],
  ['ties-break-on-id-in-both-stages', 'both sorts resolve ties the same way'],
  ['no-candidates-rank-to-nothing', 'no candidates is an empty list, not a crash'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.ranked);
  });
}

test('the output never exceeds topK or the shortlist', () => {
  for (const entry of fixture.cases) {
    const ranked = run(entry);
    assert.ok(ranked.length <= entry.topK, `${entry.id}: over topK`);
    assert.ok(ranked.length <= entry.shortlist, `${entry.id}: over the shortlist`);
  }
});

test('every result survived stage one on its cheap score', () => {
  for (const entry of fixture.cases) {
    const survivors = new Set(
      [...entry.candidates]
        .sort((a, b) => b.cheap - a.cheap || a.id.localeCompare(b.id))
        .slice(0, entry.shortlist)
        .map((candidate) => candidate.id),
    );
    for (const id of run(entry)) {
      assert.ok(survivors.has(id), `${entry.id}: ${id} was never shortlisted`);
    }
  }
});

test('the output is ordered by descending precise score', () => {
  for (const entry of fixture.cases) {
    const precise = (id: string) => entry.candidates.find((c) => c.id === id)!.precise;
    const ranked = run(entry);
    for (let i = 1; i < ranked.length; i += 1) {
      assert.ok(precise(ranked[i - 1]) >= precise(ranked[i]), `${entry.id}: rerank order is wrong`);
    }
  }
});
