import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Scores, score as Score } from './start.ts';

interface Case {
  id: string;
  retrieved: string[];
  relevant: string[];
  result: Scores;
}

const fixture = expected<{ chapter: string; k: number; cases: Case[] }>(import.meta.url);
const { score } = await loadImpl<{ score: typeof Score }>(import.meta.url);

const run = (entry: Case) => score(entry.retrieved, entry.relevant, fixture.k);

const cases: Array<[string, string]> = [
  ['a-perfect-ranking-scores-everything', 'everything relevant, nothing else, top first'],
  ['one-relevant-hit-at-the-top', 'one hit first is full recall and full rank'],
  ['the-same-hit-lower-down-costs-reciprocal-rank-only', 'position is invisible to recall'],
  ['a-relevant-document-outside-the-cut-is-not-recalled', 'k is what the model will see'],
  ['partial-recall-and-partial-precision', 'two of three, two ways'],
  ['a-short-result-list-is-scored-on-what-it-returned', 'a short list is not punished for length'],
  ['nothing-relevant-scores-zero-across-the-board', 'no hits is zero everywhere'],
  ['an-empty-result-list-scores-zero', 'returning nothing scores nothing'],
  ['a-query-with-no-relevant-documents-recalls-vacuously', 'full recall and no precision at once'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('every score is a valid rate', () => {
  for (const entry of fixture.cases) {
    for (const [name, value] of Object.entries(run(entry))) {
      assert.ok(value >= 0 && value <= 10000, `${entry.id}: ${name} is ${value}`);
    }
  }
});

test('nothing beyond k is ever counted', () => {
  for (const entry of fixture.cases) {
    assert.deepEqual(
      score(entry.retrieved.slice(0, fixture.k), entry.relevant, fixture.k),
      run(entry),
      `${entry.id}: results past the cut affected the score`,
    );
  }
});

test('reciprocal rank is zero exactly when nothing relevant is in the top k', () => {
  for (const entry of fixture.cases) {
    const anyHit = entry.retrieved.slice(0, fixture.k).some((id) => entry.relevant.includes(id));
    assert.equal(
      run(entry).rrBps > 0,
      anyHit,
      `${entry.id}: reciprocal rank disagrees with the hits`,
    );
  }
});

test('moving the first hit earlier never lowers reciprocal rank', () => {
  for (const entry of fixture.cases) {
    const before = run(entry).rrBps;
    if (before === 0 || entry.relevant.length === 0) continue;
    const promoted = [entry.relevant[0], ...entry.retrieved];
    assert.ok(
      score(promoted, entry.relevant, fixture.k).rrBps >= before,
      `${entry.id}: promoting a hit lowered its rank score`,
    );
  }
});

test('recall and precision cannot see position', () => {
  for (const entry of fixture.cases) {
    const shuffled = [...entry.retrieved.slice(0, fixture.k)].reverse();
    const moved = score(shuffled, entry.relevant, fixture.k);
    const original = run(entry);
    assert.equal(moved.recallBps, original.recallBps, `${entry.id}: recall saw position`);
    assert.equal(moved.precisionBps, original.precisionBps, `${entry.id}: precision saw position`);
  }
});
