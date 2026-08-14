import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Config, Plan, Step, plan as PlanFn } from './start.ts';

interface Case {
  id: string;
  steps: Step[];
  result: Plan;
}

const fixture = expected<{ chapter: string; config: Config; cases: Case[] }>(import.meta.url);
const { plan } = await loadImpl<{ plan: typeof PlanFn }>(import.meta.url);

const run = (steps: Step[]) => plan(steps, fixture.config);
const local = (steps: Step[]) =>
  run(steps).placements.flatMap((placement, index) => (placement.mode === 'local' ? [steps[index]] : []));

const cases: Array<[string, string]> = [
  ['validation-on-the-entry-path-runs-local', 'a cheap check skips the round trip'],
  ['a-model-call-is-never-local', 'short, on the path, and still an activity'],
  ['a-step-that-heartbeats-is-never-local', 'local activities have no heartbeat'],
  ['a-step-that-must-hear-a-signal-is-never-local', 'a local activity blocks the mailbox'],
  ['a-step-longer-than-the-task-window-is-never-local', 'it would fight a mechanism it cannot join'],
  ['a-step-exactly-at-the-budget-still-runs-local', 'the boundary is inclusive'],
  ['everything-after-the-acknowledgement-is-left-alone', 'deliberately unoptimized'],
  ['the-first-disqualifying-reason-is-the-one-reported', 'the check order is fixed'],
  ['the-atlas-entry-path-pays-no-round-trips', 'the whole entry path, and no dispatch'],
  ['a-workflow-with-no-steps-costs-nothing', 'nothing to place'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(run(entry.steps), entry.result);
  });
}

test('one placement per step, in order', () => {
  for (const entry of fixture.cases) {
    assert.deepEqual(run(entry.steps).placements.map((p) => p.name), entry.steps.map((s) => s.name), entry.id);
  }
});

test('a model call is never placed locally, whatever else is true of it', () => {
  for (const entry of fixture.cases) {
    for (const step of local(entry.steps)) {
      assert.notEqual(step.kind, 'model', `${entry.id}: ${step.name} would block steering`);
    }
    for (const step of entry.steps) {
      const forced = run([{ ...step, kind: 'model' as const }]).placements[0];
      assert.equal(forced.mode, 'activity', `${entry.id}: ${step.name} as a model call went local`);
      assert.equal(forced.reason, 'model_call', entry.id);
    }
  }
});

test('nothing that needs a heartbeat is placed locally', () => {
  for (const entry of fixture.cases) {
    for (const step of local(entry.steps)) assert.equal(step.needsHeartbeat, false, entry.id);
    for (const step of entry.steps) {
      const forced = run([{ ...step, needsHeartbeat: true }]).placements[0];
      assert.equal(forced.mode, 'activity', `${entry.id}: ${step.name} heartbeats into a void`);
    }
  }
});

test('nothing that must stay reachable is placed locally', () => {
  for (const entry of fixture.cases) {
    for (const step of local(entry.steps)) assert.equal(step.needsSignals, false, entry.id);
    for (const step of entry.steps) {
      const forced = run([{ ...step, needsSignals: true }]).placements[0];
      assert.equal(forced.mode, 'activity', `${entry.id}: ${step.name} would swallow an approval`);
    }
  }
});

test('nothing longer than the budget is placed locally', () => {
  for (const entry of fixture.cases) {
    for (const step of local(entry.steps)) {
      assert.ok(step.durationMs <= fixture.config.localBudgetMs, `${entry.id}: ${step.name} runs too long`);
    }
  }
});

test('nothing off the entry path is placed locally', () => {
  for (const entry of fixture.cases) {
    for (const step of local(entry.steps)) assert.equal(step.onEntryPath, true, entry.id);
  }
});

test('the entry latency counts the entry path and nothing else', () => {
  for (const entry of fixture.cases) {
    const offPath = entry.steps.filter((step) => !step.onEntryPath);
    if (offPath.length === 0) continue;
    const without = run(entry.steps.filter((step) => step.onEntryPath));
    assert.equal(without.entryLatencyMs, run(entry.steps).entryLatencyMs, `${entry.id}: off-path work was billed`);
  }
});

test('the entry latency is never worse than paying every round trip', () => {
  for (const entry of fixture.cases) {
    const onPath = entry.steps.filter((step) => step.onEntryPath);
    const unoptimized = onPath.reduce((sum, step) => sum + step.durationMs + fixture.config.roundTripMs, 0);
    assert.ok(run(entry.steps).entryLatencyMs <= unoptimized, `${entry.id}: placement cost time`);
  }
});

test('shortening a step never moves it off the local path, and can move it on', () => {
  for (const entry of fixture.cases) {
    const placements = run(entry.steps).placements;
    entry.steps.forEach((step, index) => {
      const shortened = run([{ ...step, durationMs: 0 }]).placements[0];
      if (placements[index].mode === 'local') {
        assert.equal(shortened.mode, 'local', `${entry.id}: ${step.name} got slower by getting faster`);
      }
      if (placements[index].reason === 'too_long') {
        assert.equal(shortened.mode, 'local', `${entry.id}: ${step.name} was only ever too long`);
      }
    });
  }
});
