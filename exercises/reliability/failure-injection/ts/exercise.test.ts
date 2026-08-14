import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Caps, Report, Run, check as Check } from './start.ts';

interface Case {
  id: string;
  run: Run;
  result: Report;
}

const fixture = expected<{ chapter: string; caps: Caps; cases: Case[] }>(import.meta.url);
const { check } = await loadImpl<{ check: typeof Check }>(import.meta.url);

const run = (subject: Run, caps = fixture.caps) => check(subject, caps);
const SIX = ['terminal', 'no_duplicate', 'bounded', 'escalated', 'traceable', 'contained'];

const cases: Array<[string, string]> = [
  ['a-clean-recovery-holds-every-promise', 'the fault was absorbed'],
  ['a-run-that-is-neither-done-nor-failed-is-stuck', 'no exception, no progress'],
  ['killing-between-the-effect-and-the-record-issued-two-credits', 'the reason the dedup table exists'],
  ['a-fault-handled-correctly-and-expensively', 'it worked, at four times the price'],
  ['an-unresolvable-run-that-nobody-was-told-about', 'a failure with no owner'],
  ['an-escalation-with-no-reason-attached', 'a queue item nobody can action'],
  ['an-injected-fault-that-looks-like-a-real-one', 'a game day that pages for real'],
  ['the-fallback-path-forgot-the-tenant', 'a cross-tenant bug that needs an incident'],
  ['a-degraded-run-that-broke-three-promises', 'each violation names its promise'],
  ['a-wrong-result-the-re-derivation-caught', 'the defence the injection was for'],
  ['the-invariants-all-hold-and-the-answer-is-wrong', 'the class with no signal'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(run(entry.run), entry.result);
  });
}

test('passed is exactly whether nothing was violated', () => {
  for (const entry of fixture.cases) {
    const { violations, passed } = run(entry.run);
    assert.equal(passed, violations.length === 0, `${entry.id}: ${violations.join(', ')}`);
  }
});

test('the six invariants are partitioned between held and violated', () => {
  for (const entry of fixture.cases) {
    const { violations, held } = run(entry.run);
    assert.deepEqual([...violations, ...held].sort(), [...SIX].sort(), entry.id);
    assert.deepEqual(violations, SIX.filter((name) => violations.includes(name)), `${entry.id}: order`);
    assert.deepEqual(held, SIX.filter((name) => held.includes(name)), `${entry.id}: order`);
  }
});

test('whether the answer was right is not an input', () => {
  for (const entry of fixture.cases) {
    const flipped = { ...entry.run, answerCorrect: !entry.run.answerCorrect };
    assert.deepEqual(run(flipped), run(entry.run), `${entry.id}: the checker read the outcome`);
  }
});

test('a run still going always violates terminal', () => {
  for (const entry of fixture.cases) {
    const stuck = run({ ...entry.run, terminalState: 'running' });
    assert.ok(stuck.violations.includes('terminal'), `${entry.id}: a stuck run passed`);
    for (const state of ['completed', 'failed', 'escalated']) {
      const done = run({ ...entry.run, terminalState: state });
      assert.ok(!done.violations.includes('terminal'), `${entry.id}: ${state} read as stuck`);
    }
  }
});

test('an effect that happened twice always violates no_duplicate', () => {
  for (const entry of fixture.cases) {
    const doubled = run({ ...entry.run, effects: [...entry.run.effects, { name: 'issue_credit', count: 2 }] });
    assert.ok(doubled.violations.includes('no_duplicate'), `${entry.id}: a second effect went unnoticed`);
  }
});

test('raising the caps never adds a bounded violation', () => {
  for (const entry of fixture.cases) {
    const generous = run(entry.run, { costCents: 1_000_000, turns: 1_000_000 });
    assert.ok(!generous.violations.includes('bounded'), `${entry.id}: a huge cap still bound`);
    const tight = run(entry.run, { costCents: 0, turns: 0 });
    assert.ok(tight.violations.includes('bounded') || entry.run.costCents + entry.run.turns === 0, entry.id);
  }
});

test('an unresolvable run held only if it escalated with a reason', () => {
  for (const entry of fixture.cases) {
    const stranded = run({ ...entry.run, unresolved: true, terminalState: 'failed', escalationReason: null });
    assert.ok(stranded.violations.includes('escalated'), `${entry.id}: an unresolved run was abandoned`);
    const routed = run({ ...entry.run, unresolved: true, terminalState: 'escalated', escalationReason: 'because' });
    assert.ok(!routed.violations.includes('escalated'), `${entry.id}: a proper escalation was flagged`);
  }
});

test('an unrecorded fault or recovery always violates traceable', () => {
  for (const entry of fixture.cases) {
    for (const trace of [
      { injectedFault: null, recoveryRecorded: true },
      { injectedFault: 'anything', recoveryRecorded: false },
    ]) {
      assert.ok(run({ ...entry.run, trace }).violations.includes('traceable'), `${entry.id}: ${JSON.stringify(trace)}`);
    }
  }
});

test('any boundary crossed while degraded always violates contained', () => {
  for (const entry of fixture.cases) {
    for (const key of ['tenantPropagated', 'taintHeld', 'authorized'] as const) {
      const leaky = run({ ...entry.run, boundaries: { ...entry.run.boundaries, [key]: false } });
      assert.ok(leaky.violations.includes('contained'), `${entry.id}: ${key} was crossed unnoticed`);
    }
  }
});
