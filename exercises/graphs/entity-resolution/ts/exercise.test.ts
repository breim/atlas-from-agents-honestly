import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Pair, resolve as Resolve } from './start.ts';

interface Case {
  id: string;
  pairs: Pair[];
  clusters: string[][];
}

const fixture = expected<{
  chapter: string;
  threshold: number;
  records: string[];
  cases: Case[];
}>(import.meta.url);
const { resolve } = await loadImpl<{ resolve: typeof Resolve }>(import.meta.url);

const run = (entry: Case) => resolve(fixture.records, entry.pairs, fixture.threshold);

const cases: Array<[string, string]> = [
  ['no-pair-clears-the-threshold', 'weak matches leave records alone'],
  ['a-matching-pair-merges', 'a confident match makes a cluster'],
  ['the-threshold-is-inclusive', 'exactly at the bar merges'],
  ['one-basis-point-under-does-not-merge', 'one basis point under does not'],
  ['a-chain-merges-records-that-never-matched-each-other', 'transitivity is not optional'],
  ['an-uncompared-pair-never-merges', 'blocking decides what can ever merge'],
  ['two-independent-clusters-stay-separate', 'separate components stay separate'],
  ['everything-can-collapse-into-one-cluster', 'a chain of matches becomes one blob'],
  ['no-pairs-leaves-every-record-alone', 'no comparisons is all singletons'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.clusters);
  });
}

test('every record lands in exactly one cluster', () => {
  for (const entry of fixture.cases) {
    assert.deepEqual(
      run(entry).flat().sort(),
      [...fixture.records].sort(),
      `${entry.id}: a record was lost or duplicated`,
    );
  }
});

test('every matching pair ends up in the same cluster', () => {
  for (const entry of fixture.cases) {
    const clusters = run(entry);
    for (const pair of entry.pairs) {
      if (pair.score < fixture.threshold) continue;
      const holding = clusters.find((cluster) => cluster.includes(pair.a))!;
      assert.ok(holding.includes(pair.b), `${entry.id}: ${pair.a} and ${pair.b} did not merge`);
    }
  }
});

test('two records only share a cluster through a chain of matches', () => {
  for (const entry of fixture.cases) {
    const merged = new Map(fixture.records.map((id) => [id, id]));
    const find = (id: string): string => {
      while (merged.get(id) !== id) id = merged.get(id)!;
      return id;
    };
    for (const pair of entry.pairs) {
      if (pair.score >= fixture.threshold) merged.set(find(pair.a), find(pair.b));
    }
    for (const cluster of run(entry)) {
      for (const id of cluster) {
        assert.equal(find(id), find(cluster[0]), `${entry.id}: ${id} merged without a chain`);
      }
    }
  }
});

test('pair order never changes the clusters', () => {
  for (const entry of fixture.cases) {
    assert.deepEqual(
      resolve(fixture.records, [...entry.pairs].reverse(), fixture.threshold),
      run(entry),
      `${entry.id}: the clusters depend on comparison order`,
    );
  }
});

test('raising the threshold never merges more', () => {
  for (const entry of fixture.cases) {
    const stricter = resolve(fixture.records, entry.pairs, fixture.threshold + 1000);
    assert.ok(
      stricter.length >= run(entry).length,
      `${entry.id}: a stricter threshold produced fewer clusters`,
    );
  }
});
