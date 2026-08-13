import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { FanOut, fanOut as FanOutFn } from './start.ts';

interface Case {
  id: string;
  items: string[];
  limit: number;
  failures: string[];
  result: FanOut;
}

const fixture = expected<{ chapter: string; cases: Case[] }>(import.meta.url);
const { fanOut } = await loadImpl<{ fanOut: typeof FanOutFn }>(import.meta.url);

const run = (entry: Case) => fanOut(entry.items, entry.limit, entry.failures);

const cases: Array<[string, string]> = [
  ['everything-fits-in-one-wave', 'work under the cap runs in one go'],
  ['the-concurrency-cap-splits-the-work', 'the cap decides how many run together'],
  ['one-failure-does-not-cancel-the-others', 'a sibling failure is not contagious'],
  ['a-failure-does-not-stop-later-waves', 'a first-wave failure does not abort the batch'],
  ['every-item-failing-is-still-every-item-reported', 'total failure still reports per item'],
  ['a-limit-of-one-is-sequential', 'a cap of one is a legitimate setting'],
  ['no-items-produce-no-waves', 'nothing to do is no waves'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('every item gets exactly one result, in input order', () => {
  for (const entry of fixture.cases) {
    assert.deepEqual(
      run(entry).results.map((result) => result.item),
      entry.items,
      `${entry.id}: results are not in input order`,
    );
  }
});

test('no wave ever exceeds the cap', () => {
  for (const entry of fixture.cases) {
    for (const wave of run(entry).waves) {
      assert.ok(wave.length <= entry.limit, `${entry.id}: a wave of ${wave.length} over ${entry.limit}`);
    }
  }
});

test('the waves partition the items exactly once each', () => {
  for (const entry of fixture.cases) {
    assert.deepEqual(run(entry).waves.flat(), entry.items, `${entry.id}: the waves lost an item`);
  }
});

test('an item fails if and only if it was scripted to', () => {
  for (const entry of fixture.cases) {
    for (const result of run(entry).results) {
      assert.equal(
        result.ok,
        !entry.failures.includes(result.item),
        `${entry.id}: ${result.item} reported the wrong outcome`,
      );
    }
  }
});
