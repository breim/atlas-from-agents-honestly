import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Hit, Vector, nearest as Nearest } from './start.ts';

interface Case {
  id: string;
  query: number[];
  topK: number;
  hits: Hit[];
}

const fixture = expected<{ chapter: string; vectors: Vector[]; cases: Case[] }>(import.meta.url);
const { nearest } = await loadImpl<{ nearest: typeof Nearest }>(import.meta.url);

const run = (entry: Case) => nearest(entry.query, fixture.vectors, entry.topK);

const cases: Array<[string, string]> = [
  ['an-identical-direction-scores-one', 'the same direction is a perfect match'],
  ['magnitude-does-not-affect-similarity', 'a seven-times-longer vector scores identically'],
  ['a-forty-five-degree-vector-scores-about-point-seven', 'a diagonal lands where trigonometry says'],
  ['an-orthogonal-vector-scores-zero', 'unrelated is zero, not low'],
  ['an-opposite-direction-scores-minus-one', 'cosine runs from minus one, not zero'],
  ['the-zero-vector-is-excluded-not-scored', 'a directionless vector is not a result'],
  ['a-zero-query-matches-nothing', 'a directionless query has nothing to match'],
  ['topk-caps-the-results', 'topK trims the ranking'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.hits);
  });
}

test('scaling a vector never changes its score', () => {
  for (const entry of fixture.cases) {
    if (entry.query.every((x) => x === 0)) continue;
    const scaled = fixture.vectors.map((vector) => ({
      id: vector.id,
      v: vector.v.map((x) => x * 3),
    }));
    assert.deepEqual(
      nearest(entry.query, scaled, entry.topK),
      run(entry),
      `${entry.id}: magnitude leaked into the score`,
    );
  }
});

test('scaling the query never changes the scores', () => {
  for (const entry of fixture.cases) {
    assert.deepEqual(
      nearest(entry.query.map((x) => x * 5), fixture.vectors, entry.topK),
      run(entry),
      `${entry.id}: the query length affected the ranking`,
    );
  }
});

test('every score is inside the cosine range', () => {
  for (const entry of fixture.cases) {
    for (const hit of run(entry)) {
      assert.ok(hit.bps >= -10000 && hit.bps <= 10000, `${entry.id}: ${hit.id} scored ${hit.bps}`);
    }
  }
});

test('a zero vector never appears in any result', () => {
  const zeros = fixture.vectors.filter((v) => v.v.every((x) => x === 0)).map((v) => v.id);
  for (const entry of fixture.cases) {
    for (const hit of run(entry)) {
      assert.ok(!zeros.includes(hit.id), `${entry.id}: scored the zero vector ${hit.id}`);
    }
  }
});

test('results are ordered by descending score', () => {
  for (const entry of fixture.cases) {
    const hits = run(entry);
    for (let i = 1; i < hits.length; i += 1) {
      assert.ok(hits[i - 1].bps >= hits[i].bps, `${entry.id}: the ranking is out of order`);
    }
  }
});
