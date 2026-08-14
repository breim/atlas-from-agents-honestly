import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Recall, measure as Measure } from './start.ts';

interface Case {
  id: string;
  exact: string[];
  approximate: string[];
  result: Recall;
}

const fixture = expected<{ chapter: string; cases: Case[] }>(import.meta.url);
const { measure } = await loadImpl<{ measure: typeof Measure }>(import.meta.url);

const run = (entry: Case) => measure(entry.exact, entry.approximate);

const cases: Array<[string, string]> = [
  ['a-perfect-index-recalls-everything', 'an exact match recalls everything'],
  ['order-does-not-affect-recall', 'recall is a set measure'],
  ['a-missed-neighbour-lowers-recall', 'a missed neighbour costs recall'],
  ['recall-counts-overlap-not-position', 'one in three is one in three'],
  ['a-superset-still-recalls-everything', 'returning extra does not lower recall'],
  ['an-empty-approximate-result-recalls-nothing', 'finding nothing recalls nothing'],
  ['an-empty-exact-set-is-vacuously-perfect', 'a query with no answers cannot fail'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('recall is always between zero and full', () => {
  for (const entry of fixture.cases) {
    const { recallBps } = run(entry);
    assert.ok(recallBps >= 0 && recallBps <= 10000, `${entry.id}: recall of ${recallBps}`);
  }
});

test('missed is exactly what the index failed to return', () => {
  for (const entry of fixture.cases) {
    assert.deepEqual(
      run(entry).missed,
      entry.exact.filter((id) => !entry.approximate.includes(id)),
      `${entry.id}: the missed list is wrong`,
    );
  }
});

test('recall and missed always agree', () => {
  for (const entry of fixture.cases) {
    const { recallBps, missed } = run(entry);
    const rate =
      entry.exact.length === 0
        ? 10000
        : Math.floor(((entry.exact.length - missed.length) * 10000) / entry.exact.length + 0.5);
    assert.equal(recallBps, rate, `${entry.id}: recall does not match the misses`);
  }
});

test('shuffling either list never changes recall', () => {
  for (const entry of fixture.cases) {
    assert.equal(
      measure([...entry.exact].reverse(), [...entry.approximate].reverse()).recallBps,
      run(entry).recallBps,
      `${entry.id}: recall depends on order`,
    );
  }
});

test('adding a correct neighbour never lowers recall', () => {
  for (const entry of fixture.cases) {
    if (entry.exact.length === 0) continue;
    const better = measure(entry.exact, [...entry.approximate, entry.exact[0]]);
    assert.ok(
      better.recallBps >= run(entry).recallBps,
      `${entry.id}: finding more of the right answer scored worse`,
    );
  }
});
