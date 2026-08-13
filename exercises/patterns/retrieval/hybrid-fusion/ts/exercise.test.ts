import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { fuse as Fuse } from './start.ts';

interface Case {
  id: string;
  rankings: string[][];
  fused: string[];
}

const fixture = expected<{ chapter: string; k: number; cases: Case[] }>(import.meta.url);
const { fuse } = await loadImpl<{ fuse: typeof Fuse }>(import.meta.url);

const cases: Array<[string, string]> = [
  ['a-single-ranking-is-passed-through', 'fusing one ranking changes nothing'],
  ['identical-rankings-do-not-reorder', 'agreement preserves the order'],
  ['a-document-ranked-well-by-both-wins', 'the document both rankers like comes first'],
  ['consistent-mid-rank-beats-one-first-place', 'consistency outscores a single first place'],
  ['a-document-missing-from-one-ranking-scores-only-where-it-appears', 'absence is zero, not a penalty'],
  ['ties-break-on-document-id', 'a tie resolves the same way every run'],
  ['no-rankings-fuse-to-nothing', 'no input is an empty list, not a crash'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(fuse(entry.rankings, fixture.k), entry.fused);
  });
}

test('the fused set is exactly the union of the inputs', () => {
  for (const entry of fixture.cases) {
    const union = new Set(entry.rankings.flat());
    assert.deepEqual(
      [...fuse(entry.rankings, fixture.k)].sort(),
      [...union].sort(),
      `${entry.id}: a document was lost or invented`,
    );
  }
});

test('the output is ordered by descending RRF score', () => {
  for (const entry of fixture.cases) {
    const score = (id: string) =>
      entry.rankings.reduce((sum, ranking) => {
        const rank = ranking.indexOf(id);
        return rank === -1 ? sum : sum + 1 / (fixture.k + rank + 1);
      }, 0);

    const fused = fuse(entry.rankings, fixture.k);
    for (let i = 1; i < fused.length; i += 1) {
      assert.ok(
        score(fused[i - 1]) >= score(fused[i]),
        `${entry.id}: ${fused[i - 1]} ranked above ${fused[i]} on a lower score`,
      );
    }
  }
});

test('fusion is independent of the order the rankings arrive in', () => {
  for (const entry of fixture.cases) {
    assert.deepEqual(
      fuse([...entry.rankings].reverse(), fixture.k),
      fuse(entry.rankings, fixture.k),
      `${entry.id}: swapping the rankers changed the result`,
    );
  }
});
