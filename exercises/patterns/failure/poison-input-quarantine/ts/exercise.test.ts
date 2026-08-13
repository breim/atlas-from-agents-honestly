import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Drain, drain as DrainFn } from './start.ts';

interface Case {
  id: string;
  queue: string[];
  poison: string[];
  result: Drain;
}

const fixture = expected<{ chapter: string; threshold: number; cases: Case[] }>(import.meta.url);
const { drain } = await loadImpl<{ drain: typeof DrainFn }>(import.meta.url);

/** Counts real processing calls, so retrying a quarantined item is visible. */
function worker(poison: string[]) {
  let calls = 0;
  return {
    process: (item: string) => {
      calls += 1;
      return !poison.includes(item);
    },
    calls: () => calls,
  };
}

const run = (entry: Case) => {
  const { process, calls } = worker(entry.poison);
  return { outcome: drain(entry.queue, process, fixture.threshold), calls: calls() };
};

const cases: Array<[string, string]> = [
  ['a-clean-queue-drains', 'healthy items cost one attempt each'],
  ['a-poison-item-is-quarantined-after-the-threshold', 'a hopeless item stops being retried'],
  ['a-poison-item-does-not-block-the-queue', 'the item behind it still gets processed'],
  ['each-item-gets-its-own-attempt-budget', 'one bad item does not spend another budget'],
  ['a-good-item-costs-a-single-attempt', 'success does not consume the whole budget'],
  ['an-entirely-poisoned-queue-still-terminates', 'a fully poisoned queue still finishes'],
  ['an-empty-queue-attempts-nothing', 'nothing queued is nothing attempted'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry).outcome, entry.result);
  });
}

test('the reported attempt count is the real one', () => {
  for (const entry of fixture.cases) {
    const { outcome, calls } = run(entry);
    assert.equal(outcome.attempts, calls, `${entry.id}: attempts is not what happened`);
  }
});

test('every item ends up processed or quarantined, exactly once', () => {
  for (const entry of fixture.cases) {
    const { processed, quarantined } = run(entry).outcome;
    assert.deepEqual(
      [...processed, ...quarantined].sort(),
      [...entry.queue].sort(),
      `${entry.id}: an item was lost or duplicated`,
    );
  }
});

test('no item is attempted more than the threshold', () => {
  for (const entry of fixture.cases) {
    const { outcome } = run(entry);
    const ceiling = entry.queue.length * fixture.threshold;
    assert.ok(outcome.attempts <= ceiling, `${entry.id}: ${outcome.attempts} over ${ceiling}`);
  }
});

test('quarantine holds exactly the items that could never succeed', () => {
  for (const entry of fixture.cases) {
    assert.deepEqual(
      [...run(entry).outcome.quarantined].sort(),
      entry.queue.filter((item) => entry.poison.includes(item)).sort(),
      `${entry.id}: quarantine does not match the poison set`,
    );
  }
});
