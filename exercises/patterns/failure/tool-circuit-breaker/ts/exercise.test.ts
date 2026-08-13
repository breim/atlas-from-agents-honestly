import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Breaker, Call, run as Run } from './start.ts';

interface Case {
  id: string;
  calls: Call[];
  result: Breaker;
}

const fixture = expected<{
  chapter: string;
  threshold: number;
  cooldownMs: number;
  cases: Case[];
}>(import.meta.url);
const { run } = await loadImpl<{ run: typeof Run }>(import.meta.url);

const execute = (entry: Case) => run(entry.calls, fixture.threshold, fixture.cooldownMs);

const cases: Array<[string, string]> = [
  ['a-healthy-tool-is-never-tripped', 'a working tool keeps working'],
  ['failures-below-the-threshold-do-not-open-it', 'a couple of failures is not an outage'],
  ['a-success-resets-the-failure-count', 'the threshold counts consecutive failures'],
  ['the-threshold-opens-the-breaker', 'enough consecutive failures trips it'],
  ['an-open-breaker-short-circuits-without-calling', 'an open breaker sends no traffic'],
  ['the-cooldown-lets-one-probe-through', 'recovery is discovered by a single probe'],
  ['a-failed-probe-opens-the-breaker-again', 'a failed probe restarts the cooldown'],
  ['no-calls-leave-the-breaker-closed', 'no traffic is no state'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(execute(entry), entry.result);
  });
}

test('a call served open never reaches the tool, and every other call does', () => {
  for (const entry of fixture.cases) {
    const { states, reached } = execute(entry);
    const shouldReach = entry.calls.filter((_, i) => states[i] !== 'open').map((call) => call.at);
    assert.deepEqual(reached, shouldReach, `${entry.id}: reached does not match the states`);
  }
});

test('one state per call, always', () => {
  for (const entry of fixture.cases) {
    assert.equal(execute(entry).states.length, entry.calls.length, `${entry.id}: a call had no state`);
  }
});

test('a half-open probe only ever follows a full cooldown', () => {
  for (const entry of fixture.cases) {
    const { states } = execute(entry);
    states.forEach((state, index) => {
      if (state !== 'half-open') return;
      const lastOpen = states.slice(0, index).lastIndexOf('open');
      const openedFrom = lastOpen === -1 ? 0 : lastOpen;
      assert.ok(
        entry.calls[index].at - entry.calls[openedFrom].at >= 0,
        `${entry.id}: probed before the breaker had opened`,
      );
    });
  }
});

test('the breaker only opens after the threshold is met', () => {
  for (const entry of fixture.cases) {
    const { states } = execute(entry);
    const firstOpen = states.indexOf('open');
    if (firstOpen === -1) continue;
    const priorFailures = entry.calls
      .slice(0, firstOpen)
      .filter((call) => call.outcome === 'fail').length;
    assert.ok(
      priorFailures >= fixture.threshold,
      `${entry.id}: opened after only ${priorFailures} failures`,
    );
  }
});
