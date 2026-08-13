import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Collected, ItemOutcome, collect as Collect } from './start.ts';

interface Case {
  id: string;
  outcomes: ItemOutcome[];
  result: Collected;
}

const fixture = expected<{ chapter: string; cases: Case[] }>(import.meta.url);
const { collect } = await loadImpl<{ collect: typeof Collect }>(import.meta.url);

const cases: Array<[string, string]> = [
  ['everything-succeeding-is-complete', 'a clean run is complete'],
  ['some-succeeding-is-partial', 'a mixed run is partial'],
  ['a-single-failure-is-still-partial-not-failed', 'one failure does not discard the rest'],
  ['a-single-success-is-still-partial-not-failed', 'one success is not rounded away'],
  ['everything-failing-is-failed', 'a total failure is a failure'],
  ['failures-keep-their-original-order', 'the failed list is not sorted'],
  ['no-work-is-complete-not-failed', 'nothing to do is not a failure'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(collect(entry.outcomes), entry.result);
  });
}

test('every item is either a value or a failure, never both', () => {
  for (const entry of fixture.cases) {
    const { values, failed } = collect(entry.outcomes);
    assert.deepEqual(
      [...Object.keys(values), ...failed].sort(),
      entry.outcomes.map((outcome) => outcome.item).sort(),
      `${entry.id}: an item was lost or double-counted`,
    );
  }
});

test('status agrees with what actually happened', () => {
  for (const entry of fixture.cases) {
    const { status, values, failed } = collect(entry.outcomes);
    const some = Object.keys(values).length > 0;
    const none = failed.length === 0;
    const label = none ? 'complete' : some ? 'partial' : 'failed';
    assert.equal(status, label, `${entry.id}: status does not match the results`);
  }
});

test('coverage matches the values that came back', () => {
  for (const entry of fixture.cases) {
    const { values, coverage } = collect(entry.outcomes);
    const ratio =
      entry.outcomes.length === 0
        ? 1
        : Math.floor((Object.keys(values).length / entry.outcomes.length) * 10000 + 0.5) / 10000;
    assert.equal(coverage, ratio, `${entry.id}: coverage does not match the values`);
    assert.ok(coverage >= 0 && coverage <= 1, `${entry.id}: coverage outside [0, 1]`);
  }
});

test('a partial result never reports as clean or as total loss', () => {
  for (const entry of fixture.cases) {
    const { status, values, failed } = collect(entry.outcomes);
    if (Object.keys(values).length > 0 && failed.length > 0) {
      assert.equal(status, 'partial', `${entry.id}: a mixed run was collapsed to ${status}`);
    }
  }
});
