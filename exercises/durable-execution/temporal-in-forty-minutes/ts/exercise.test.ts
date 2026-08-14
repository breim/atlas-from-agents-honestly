import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Config, Event, Run, Step, World, run as RunFn } from './start.ts';

interface Case { id: string; program: Step[]; history: Event[]; world: World; config: Config; result: Run }
interface Fixture { chapter: string; cases: Case[] }

const fixture = expected<Fixture>(import.meta.url);
const { run } = await loadImpl<{ run: typeof RunFn }>(import.meta.url);

const go = (entry: Case, history = entry.history, world = entry.world, config = entry.config) =>
  run(entry.program, history, world, config);

const cases: Array<[string, string]> = [
  ['a-fresh-execution-runs-every-activity-once', 'nothing recorded, everything runs'],
  ['a-crash-and-a-replay-never-repeat-a-completed-activity', 'the row that matters'],
  ['replaying-a-finished-execution-does-nothing-at-all', 'replay rebuilds state, not effects'],
  ['a-database-read-in-workflow-code-is-a-determinism-violation', 'reads are not harmless'],
  ['the-clock-belongs-in-an-activity-too', 'anything using the clock'],
  ['the-same-work-in-an-activity-is-fine', 'the split, not the operation'],
  ['an-activity-retries-with-backoff-and-then-succeeds', 'retries are first class'],
  ['an-activity-that-never-succeeds-fails-the-workflow-at-the-cap', 'bounded, and it says so'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(go(entry), entry.result);
  });
}

test('a completed activity is never executed again, however often it is replayed', () => {
  for (const entry of fixture.cases) {
    const first = go(entry);
    if (first.status !== 'completed') continue;
    const second = go(entry, first.history);
    assert.deepEqual(second.executed, [], `${entry.id}: a replay re-ran an activity`);
    assert.deepEqual(second.history, first.history, `${entry.id}: a replay wrote new history`);
    assert.equal(second.result, first.result, `${entry.id}: a replay produced a different answer`);
    const third = go(entry, second.history);
    assert.deepEqual(third.executed, [], `${entry.id}: a third replay re-ran something`);
  }
});

test('every activity is either executed or replayed, never both and never neither', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    const activities = entry.program.filter((step) => step.kind === 'activity').map((step) => step.name);
    const seen = [...outcome.executed, ...outcome.replayed];
    for (const name of seen) assert.ok(activities.includes(name), `${entry.id}: ${name} is not an activity`);
    assert.equal(new Set(seen).size, seen.length, `${entry.id}: an activity was both executed and replayed`);
    if (outcome.status === 'completed') {
      assert.deepEqual(seen.sort(), [...activities].sort(), `${entry.id}: an activity never happened`);
    }
  }
});

test('a replayed activity reuses the value the history recorded', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    for (const event of entry.history) {
      if (!outcome.replayed.includes(event.name)) continue;
      const later = outcome.history.filter((item) => item.step === event.step);
      assert.equal(later.length, 1, `${entry.id}: ${event.name} was recorded twice`);
      assert.equal(later[0].value, event.value, `${entry.id}: a replay invented a new value`);
    }
  }
});

test('workflow code is never executed as an activity', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    const orchestration = entry.program.filter((step) => step.kind === 'workflow').map((step) => step.name);
    for (const name of orchestration) {
      assert.ok(!outcome.executed.includes(name), `${entry.id}: ${name} ran as an activity`);
      assert.ok(!outcome.history.some((event) => event.name === name), `${entry.id}: ${name} entered the history`);
    }
  }
});

test('anything non-deterministic in workflow code stops the execution before it lands', () => {
  const entry = findCase<Case>(fixture, 'the-same-work-in-an-activity-is-fine');
  for (const uses of entry.config.nondeterministic) {
    const asWorkflow = go({ ...entry, program: [{ name: 'probe', kind: 'workflow', uses: uses as never }] } as Case);
    assert.equal(asWorkflow.status, 'nondeterministic', `${uses} was allowed in workflow code`);
    assert.ok(asWorkflow.error!.includes(uses), `${uses} was rejected without saying why`);
    assert.equal(asWorkflow.result, null, 'a rejected execution returned a result');

    const asActivity = go(
      { ...entry, program: [{ name: 'probe', kind: 'activity', uses: uses as never }] } as Case,
      [],
      { results: { probe: [{ status: 'ok', value: 'v' }] } },
    );
    assert.equal(asActivity.status, 'completed', `${uses} was rejected inside an activity`);
  }
});

test('a determinism violation records nothing beyond what already happened', () => {
  const entry = findCase<Case>(fixture, 'a-database-read-in-workflow-code-is-a-determinism-violation');
  const outcome = go(entry);
  assert.equal(outcome.status, 'nondeterministic');
  const after = entry.program.findIndex((step) => step.uses);
  for (const event of outcome.history) {
    assert.ok(event.step < after, 'history was written past the violation');
  }
});

test('retries are bounded and the backoff is a deterministic exponential', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    const { maximumAttempts, initialIntervalMs, backoffCoefficient } = entry.config.retry;
    for (const attempt of outcome.attempts) {
      assert.ok(attempt.count >= 1 && attempt.count <= maximumAttempts, `${entry.id}: ${attempt.name} ran ${attempt.count}`);
      assert.equal(attempt.backoffMs.length, Math.max(0, attempt.count - 1), `${entry.id}: backoff count`);
      attempt.backoffMs.forEach((wait, index) => {
        assert.equal(wait, initialIntervalMs * backoffCoefficient ** index, `${entry.id}: backoff ${index}`);
      });
    }
  }
});

test('a failing activity stops the workflow and everything after it', () => {
  const entry = findCase<Case>(fixture, 'an-activity-that-never-succeeds-fails-the-workflow-at-the-cap');
  const outcome = go(entry);
  assert.equal(outcome.status, 'failed');
  assert.equal(outcome.attempts.at(-1)!.count, entry.config.retry.maximumAttempts, 'it gave up early');
  const failedAt = entry.program.findIndex((step) => step.name === outcome.attempts.at(-1)!.name);
  for (const step of entry.program.slice(failedAt + 1)) {
    assert.ok(!outcome.executed.includes(step.name), `${step.name} ran after the failure`);
  }
  assert.equal(outcome.result, null, 'a failed workflow returned a result');
});

test('the history only ever grows, and one event per activity that landed', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    assert.ok(outcome.history.length >= entry.history.length, `${entry.id}: history shrank`);
    const steps = outcome.history.map((event) => event.step);
    assert.equal(new Set(steps).size, steps.length, `${entry.id}: a step was recorded twice`);
    assert.deepEqual([...steps].sort((a, b) => a - b), steps, `${entry.id}: history is out of order`);
    for (const event of outcome.history) {
      assert.equal(entry.program[event.step].name, event.name, `${entry.id}: an event names the wrong step`);
      assert.equal(entry.program[event.step].kind, 'activity', `${entry.id}: workflow code entered the history`);
    }
  }
});

test('resuming from any prefix of the history reaches the same result', () => {
  for (const entry of fixture.cases) {
    const full = go(entry);
    if (full.status !== 'completed') continue;
    for (let cut = 0; cut <= full.history.length; cut += 1) {
      const resumed = go(entry, full.history.slice(0, cut));
      assert.equal(resumed.status, 'completed', `${entry.id}: resuming from ${cut} events failed`);
      assert.equal(resumed.result, full.result, `${entry.id}: resuming from ${cut} events changed the answer`);
      assert.deepEqual(resumed.history, full.history, `${entry.id}: resuming from ${cut} events rewrote history`);
      assert.equal(resumed.replayed.length, cut, `${entry.id}: resuming from ${cut} events replayed the wrong count`);
    }
  }
});
