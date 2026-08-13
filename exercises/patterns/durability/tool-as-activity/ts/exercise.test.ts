import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Recorded, Replay, replay as ReplayFn } from './start.ts';

interface Case {
  id: string;
  history: Recorded[];
  calls: string[];
  result: Replay;
}

const fixture = expected<{ chapter: string; cases: Case[] }>(import.meta.url);
const { replay } = await loadImpl<{ replay: typeof ReplayFn }>(import.meta.url);

/** Counts real executions, so a recorded result returned after executing still counts. */
function spy() {
  let calls = 0;
  return {
    run: (activity: string) => {
      calls += 1;
      return `ran ${activity}`;
    },
    calls: () => calls,
  };
}

const run = (entry: Case) => {
  const { run: fn, calls } = spy();
  return { outcome: replay(entry.history, entry.calls, fn), executed: calls() };
};

const cases: Array<[string, string]> = [
  ['a-first-run-executes-and-records', 'the first pass actually runs the tool'],
  ['a-replay-returns-the-recorded-result-without-executing', 'a replay does not touch the world'],
  ['a-partial-history-replays-then-executes', 'replay stops where the history does'],
  ['history-is-consumed-in-order-not-by-name', 'two identical calls have two distinct results'],
  ['a-history-that-disagrees-is-non-determinism', 'a divergent replay refuses to guess'],
  ['no-calls-execute-nothing', 'an empty workflow executes nothing'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry).outcome, entry.result);
  });
}

test('the reported invocation count is the real one', () => {
  for (const entry of fixture.cases) {
    const { outcome, executed } = run(entry);
    assert.equal(outcome.invocations, executed, `${entry.id}: invocations is not what happened`);
  }
});

test('a replayed call never executes', () => {
  for (const entry of fixture.cases) {
    const { executed } = run(entry);
    const replayed = Math.min(entry.history.length, entry.calls.length);
    assert.ok(
      executed <= Math.max(0, entry.calls.length - replayed),
      `${entry.id}: executed ${executed} with ${replayed} already recorded`,
    );
  }
});

test('non-determinism leaves the history untouched', () => {
  for (const entry of fixture.cases) {
    const { outcome, executed } = run(entry);
    if (!outcome.error) continue;
    assert.deepEqual(outcome.history, entry.history, `${entry.id}: mutated a divergent history`);
    assert.equal(executed, 0, `${entry.id}: executed despite divergence`);
  }
});
