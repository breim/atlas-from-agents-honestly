import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Entry, Failure, Routing, route as Route } from './start.ts';

interface Case {
  id: string;
  failures: Failure[];
  result: Routing;
}

const fixture = expected<{ chapter: string; catalogue: Record<string, Entry>; cases: Case[] }>(import.meta.url);
const { route } = await loadImpl<{ route: typeof Route }>(import.meta.url);

const run = (failures: Failure[], catalogue = fixture.catalogue) => route(failures, catalogue);
const entryOf = (failure: Failure) => fixture.catalogue[failure.code];

const cases: Array<[string, string]> = [
  ['a-transient-failure-is-retried-and-never-seen', 'waiting fixes it, so nobody else hears'],
  ['a-rate-limit-carries-its-own-schedule', 'the header exists here and nowhere later'],
  ['a-context-length-error-is-permanent-not-transient', 'three more rejections, billed each time'],
  ['the-model-mistake-goes-back-into-the-transcript', 'written as an instruction'],
  ['your-bug-stays-in-your-logs', 'the same class, the opposite audience'],
  ['a-refusal-is-policy-and-is-not-rephrased', 'a workaround for a control is not a fix'],
  ['budget-exhaustion-is-not-an-error', 'the system working, at ERROR'],
  ['the-error-rate-is-a-floor', 'a 200, a clean trace, a wrong answer'],
  ['one-root-cause-lands-in-four-classes', 'four dashboards, one incident'],
  ['an-hour-with-no-failures', 'nothing raised, nothing to route'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(run(entry.failures), entry.result);
  });
}

test('one routing per failure, in order', () => {
  for (const entry of fixture.cases) {
    assert.deepEqual(run(entry.failures).routed.map((r) => r.id), entry.failures.map((f) => f.id), entry.id);
  }
});

test('only a transient failure is ever retried', () => {
  for (const entry of fixture.cases) {
    for (const routed of run(entry.failures).routed) {
      assert.equal(routed.retryable, routed.class === 'transient', `${entry.id}: ${routed.class} retryability`);
    }
  }
});

test('only a policy failure ever escalates', () => {
  for (const entry of fixture.cases) {
    for (const routed of run(entry.failures).routed) {
      assert.equal(routed.escalates, routed.class === 'policy', `${entry.id}: ${routed.class} escalation`);
    }
  }
});

test('a recovered transient failure is never shown to the model', () => {
  for (const entry of fixture.cases) {
    for (const routed of run(entry.failures).routed) {
      if (routed.class !== 'transient') continue;
      assert.equal(routed.modelFacing, null, `${entry.id}: the model was told about the network`);
    }
  }
});

test('the model sees an error exactly when it is the one who can act', () => {
  for (const entry of fixture.cases) {
    const routed = run(entry.failures).routed;
    entry.failures.forEach((failure, index) => {
      const { class: cls, blame } = entryOf(failure);
      const actionable = cls === 'policy' || cls === 'budget' || (cls === 'permanent' && blame === 'model');
      const owed = actionable ? failure.instruction : null;
      assert.equal(routed[index].modelFacing, owed, `${entry.id}: ${failure.code}`);
    });
  }
});

test('a retry schedule only survives on something that will be retried', () => {
  for (const entry of fixture.cases) {
    const impatient = entry.failures.map((failure) => ({ ...failure, retryAfterMs: 9000 }));
    for (const routed of run(impatient).routed) {
      const owed = routed.class === 'transient' ? 9000 : null;
      assert.equal(routed.retryAfterMs, owed, `${entry.id}: ${routed.class} carried a schedule`);
    }
  }
});

test('budget and semantic never reach the error rate, and the rest always do', () => {
  for (const entry of fixture.cases) {
    const { routed, countedInErrorRate } = run(entry.failures);
    for (const item of routed) {
      const silent = item.class === 'budget' || item.class === 'semantic';
      assert.equal(countedInErrorRate.includes(item.id), !silent, `${entry.id}: ${item.class} counting`);
    }
  }
});

test('nothing semantic is ever retried, escalated, or shown', () => {
  for (const entry of fixture.cases) {
    for (const routed of run(entry.failures).routed) {
      if (routed.class !== 'semantic') continue;
      assert.deepEqual(
        [routed.retryable, routed.escalates, routed.modelFacing],
        [false, false, null],
        `${entry.id}: this part has no mechanism for it`,
      );
    }
  }
});

test('reclassifying a code moves only the failures that carry it', () => {
  for (const entry of fixture.cases) {
    for (const code of new Set(entry.failures.map((failure) => failure.code))) {
      const reclassified = { ...fixture.catalogue, [code]: { class: 'transient' as const, blame: 'world' as const } };
      const after = run(entry.failures, reclassified).routed;
      run(entry.failures).routed.forEach((before, index) => {
        if (entry.failures[index].code === code) return;
        assert.deepEqual(after[index], before, `${entry.id}: reclassifying ${code} moved ${before.id}`);
      });
    }
  }
});
