import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Bounds, Config, Placement, Run, port as PortFn } from './start.ts';

interface Case { id: string; plan: Placement[]; bounds: Bounds; workflowId: string; config: Config; result: Run }
interface Fixture { chapter: string; config: Config; cases: Case[] }

const fixture = expected<Fixture>(import.meta.url);
const { port } = await loadImpl<{ port: typeof PortFn }>(import.meta.url);

const go = (entry: Case, plan = entry.plan, workflowId = entry.workflowId, config = entry.config) =>
  port(plan, entry.bounds, workflowId, config);

const cases: Array<[string, string]> = [
  ['the-ported-loop-looks-like-the-original', 'no state machine, no resume handler'],
  ['a-model-call-in-workflow-code-is-rejected', 'the one rule'],
  ['the-deadline-cannot-read-the-clock', 'the server enforces it, even when you are wedged'],
  ['a-model-activity-that-does-not-heartbeat-is-billed-twice', 'retried while still running'],
  ['a-fast-model-activity-without-a-heartbeat-is-fine', 'the hazard is slowness, not the call'],
  ['an-oversized-return-value-is-journalled-forever', 'project inside the activity'],
  ['a-transcript-that-outgrows-the-history-is-rejected', 'hold a reference and a cursor'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(go(entry), entry.result);
  });
}

test('nothing that touches the world is left in workflow code', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    for (const step of entry.plan) {
      if (step.kind !== 'workflow' || step.effect === 'decision') continue;
      assert.ok(
        outcome.errors.some((error) => error.startsWith(step.name)),
        `${entry.id}: ${step.name} is a ${step.effect} in workflow code and was accepted`,
      );
      assert.equal(outcome.status, 'rejected', entry.id);
    }
  }
});

test('a model call is rejected in workflow code and accepted as an activity', () => {
  const entry = findCase<Case>(fixture, 'the-ported-loop-looks-like-the-original');
  for (const effect of ['model', 'tool'] as const) {
    const asWorkflow = go(entry, [{ name: 'probe', kind: 'workflow', effect }]);
    assert.equal(asWorkflow.status, 'rejected', `${effect} was allowed in workflow code`);
    const asActivity = go(entry, [{ name: 'probe', kind: 'activity', effect, payloadBytes: 10, heartbeats: true, durationMs: 1 }]);
    assert.equal(asActivity.status, 'completed', `${effect} was rejected as an activity`);
  }
});

test('the clock is never allowed in workflow code, and the deadline is the platform', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    assert.equal(outcome.bounds.deadline, 'platform', `${entry.id}: the deadline stayed yours`);
    assert.equal(outcome.bounds.steps, 'yours', `${entry.id}: the step cap moved`);
    assert.equal(outcome.bounds.cost, 'yours', `${entry.id}: the cost cap moved`);
    for (const step of entry.plan) {
      if (step.effect !== 'clock') continue;
      assert.ok(
        outcome.errors.some((error) => error.includes('run timeout')),
        `${entry.id}: reading the clock was accepted`,
      );
    }
  }
});

test('every activity gets a key derived from the workflow id, and only activities do', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    const activities = entry.plan.filter((step) => step.kind === 'activity').map((step) => step.name);
    assert.deepEqual(outcome.activities.map((item) => item.name), activities, `${entry.id}: the wrong set`);
    for (const activity of outcome.activities) {
      assert.equal(activity.idempotencyKey, `${entry.workflowId}:${activity.name}`, `${entry.id}: key`);
    }
  }
});

test('the key is stable for one execution and different for another', () => {
  const entry = findCase<Case>(fixture, 'the-ported-loop-looks-like-the-original');
  const first = go(entry, entry.plan, 'atlas-8823');
  const again = go(entry, entry.plan, 'atlas-8823');
  const other = go(entry, entry.plan, 'atlas-9100');
  assert.deepEqual(again.activities, first.activities, 'the key was not stable across runs');
  for (const [index, activity] of other.activities.entries()) {
    assert.notEqual(activity.idempotencyKey, first.activities[index].idempotencyKey, 'two runs shared a key');
  }
  assert.equal(new Set(first.activities.map((item) => item.idempotencyKey)).size, first.activities.length, 'collision');
});

test('a slow model activity is double billed exactly when it does not heartbeat', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    for (const activity of outcome.activities) {
      const step = entry.plan.find((item) => item.name === activity.name)!;
      const owed =
        step.effect === 'model' && !step.heartbeats && (step.durationMs ?? 0) > entry.config.activityTimeoutMs;
      assert.equal(activity.doubleBilled, owed, `${entry.id}: ${activity.name} billing`);
    }
  }
});

test('heartbeating is what fixes it, not shortening the timeout', () => {
  const entry = findCase<Case>(fixture, 'a-model-activity-that-does-not-heartbeat-is-billed-twice');
  const fixed = go(entry, entry.plan.map((step) => (step.effect === 'model' ? { ...step, heartbeats: true } : step)));
  assert.equal(fixed.status, 'completed', 'heartbeating did not fix the double billing');
  assert.ok(!fixed.activities.some((activity) => activity.doubleBilled), 'still billed twice');
});

test('the history is exactly what the activities return, and nothing else', () => {
  for (const entry of fixture.cases) {
    const owed = entry.plan
      .filter((step) => step.kind === 'activity')
      .reduce((total, step) => total + (step.payloadBytes ?? 0), 0);
    assert.equal(go(entry).historyBytes, owed, `${entry.id}: the history size is wrong`);
  }
});

test('a payload over the cap is refused, at the cap exactly', () => {
  const entry = findCase<Case>(fixture, 'the-ported-loop-looks-like-the-original');
  const cap = entry.config.maxPayloadBytes;
  for (const bytes of [cap - 1, cap, cap + 1]) {
    const outcome = go(entry, [{ name: 'probe', kind: 'activity', effect: 'tool', payloadBytes: bytes }]);
    assert.equal(outcome.status === 'rejected', bytes > cap, `${bytes} against a cap of ${cap}`);
  }
});

test('a rejected plan says every reason, not just the first', () => {
  const entry = findCase<Case>(fixture, 'the-ported-loop-looks-like-the-original');
  const broken = go(entry, [
    { name: 'a', kind: 'workflow', effect: 'model' },
    { name: 'b', kind: 'workflow', effect: 'clock' },
    { name: 'c', kind: 'activity', effect: 'tool', payloadBytes: entry.config.maxPayloadBytes + 1 },
  ]);
  assert.equal(broken.status, 'rejected');
  assert.equal(broken.errors.length, 3, 'a rejected plan reported fewer reasons than it had');
  for (const name of ['a', 'b', 'c']) {
    assert.ok(broken.errors.some((error) => error.startsWith(name)), `${name} was not reported`);
  }
});
