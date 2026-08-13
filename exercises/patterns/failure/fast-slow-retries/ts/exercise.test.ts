import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Policy, Retry, retry as RetryFn } from './start.ts';

interface Case {
  id: string;
  failures: number;
  result: Retry;
}

const fixture = expected<Policy & { chapter: string; cases: Case[] }>(import.meta.url);
const policy: Policy = {
  fastAttempts: fixture.fastAttempts,
  fastMs: fixture.fastMs,
  slowAttempts: fixture.slowAttempts,
  slowMs: fixture.slowMs,
};
const { retry } = await loadImpl<{ retry: typeof RetryFn }>(import.meta.url);

const run = (entry: Case) => retry(entry.failures, policy);

const cases: Array<[string, string]> = [
  ['the-first-attempt-waits-for-nothing', 'the first attempt is immediate'],
  ['a-blip-is-absorbed-by-the-fast-tier', 'a single failure retries fast'],
  ['the-fast-tier-is-exhausted-before-the-slow-one-begins', 'the tiers do not interleave'],
  ['the-slow-tier-takes-over-for-an-outage', 'a sustained failure backs off hard'],
  ['both-tiers-exhausted-gives-up', 'giving up is a real outcome'],
  ['failing-forever-still-stops', 'no schedule is unbounded'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('the schedule always begins immediately', () => {
  for (const entry of fixture.cases) {
    assert.equal(run(entry).schedule[0], 0, `${entry.id}: waited before the first attempt`);
  }
});

test('the schedule length is the attempt count', () => {
  for (const entry of fixture.cases) {
    const { schedule, attempts } = run(entry);
    assert.equal(schedule.length, attempts, `${entry.id}: schedule and attempts disagree`);
  }
});

test('no delay ever decreases', () => {
  for (const entry of fixture.cases) {
    const { schedule } = run(entry);
    for (let i = 1; i < schedule.length; i += 1) {
      assert.ok(schedule[i] >= schedule[i - 1], `${entry.id}: the backoff went backwards`);
    }
  }
});

test('attempts never exceed the two tiers combined', () => {
  const ceiling = policy.fastAttempts + policy.slowAttempts;
  for (const entry of fixture.cases) {
    assert.ok(run(entry).attempts <= ceiling, `${entry.id}: over the total attempt budget`);
  }
});

test('giving up happens exactly when the budget ran out', () => {
  const ceiling = policy.fastAttempts + policy.slowAttempts;
  for (const entry of fixture.cases) {
    const { gaveUp, attempts } = run(entry);
    assert.equal(
      gaveUp,
      entry.failures >= ceiling,
      `${entry.id}: gaveUp disagrees with the budget after ${attempts} attempts`,
    );
  }
});
