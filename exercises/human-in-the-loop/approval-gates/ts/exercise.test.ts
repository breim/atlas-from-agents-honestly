import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Decision, Gate, Policy, Verdict, gate as GateFn } from './start.ts';

interface Case { id: string; spec: Gate; decision: Decision; presentedAtMs: number; policy: Policy; result: Verdict }
interface Fixture { chapter: string; policy: Policy; cases: Case[] }

const fixture = expected<Fixture>(import.meta.url);
const { gate } = await loadImpl<{ gate: typeof GateFn }>(import.meta.url);
const go = (entry: Case, spec = entry.spec, decision = entry.decision, presented = entry.presentedAtMs) =>
  gate(spec, decision, presented, entry.policy);
const ANSWERS = ['approve', 'deny', 'edit', 'escalate'];

const cases: Array<[string, string]> = [
  ['an-approval-acts-on-the-one-call-the-gate-holds', 'one call, one gate'],
  ['an-edit-is-what-reviewers-actually-want', 'the missing fourth answer'],
  ['a-denial-carries-an-instruction-and-branches', 'deny is a branch'],
  ['a-denial-with-no-reason-is-not-an-instruction', 'a reason the model can act on'],
  ['an-escalation-halts-rather-than-revising', 'the fourth answer'],
  ['a-decision-past-its-validity-is-rejected-before-it-is-recorded', 'an update, not a signal'],
  ['a-gate-holding-two-side-effects-is-refused', 'resume runs it from the top'],
  ['a-gate-that-hides-a-material-fact-is-refused', 'latency without oversight'],
  ['a-gate-with-only-approve-and-deny-is-refused', 'four answers, not two'],
  ['an-expiry-that-outlives-the-data-is-refused', 'a decision about a state'],
  ['an-execution-gate-in-the-fast-lane-is-refused', 'one mixed queue, wrong attention'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(go(entry), entry.result);
  });
}

test('an invalid gate never records a decision', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    if (outcome.status !== 'invalid') continue;
    assert.equal(outcome.applied, null, `${entry.id}: an invalid gate applied something`);
    assert.equal(outcome.next, 'none', `${entry.id}: an invalid gate advanced`);
    assert.ok(outcome.errors.length > 0, entry.id);
  }
});

test('a gate holding anything but exactly one side effect is refused', () => {
  const entry = findCase<Case>(fixture, 'an-approval-acts-on-the-one-call-the-gate-holds');
  for (const effects of [[], ['a'], ['a', 'b'], ['a', 'b', 'c']]) {
    const outcome = go(entry, { ...entry.spec, sideEffects: effects });
    assert.equal(outcome.status === 'invalid', effects.length !== 1, `${effects.length} side effects`);
  }
});

test('every field the policy requires must be shown, one at a time', () => {
  const entry = findCase<Case>(fixture, 'an-approval-acts-on-the-one-call-the-gate-holds');
  for (const field of entry.policy.required) {
    const hidden = entry.spec.disclose.filter((item) => item !== field);
    const outcome = go(entry, { ...entry.spec, disclose: hidden });
    assert.equal(outcome.status, 'invalid', `hiding ${field} was accepted`);
    assert.ok(outcome.errors.some((error) => error.includes(field)), `hiding ${field} was refused silently`);
  }
});

test('all four answers must be offered, one missing at a time', () => {
  const entry = findCase<Case>(fixture, 'an-approval-acts-on-the-one-call-the-gate-holds');
  for (const answer of ANSWERS) {
    const outcome = go(entry, { ...entry.spec, answers: ANSWERS.filter((item) => item !== answer) });
    assert.equal(outcome.status, 'invalid', `a gate without ${answer} was accepted`);
    assert.ok(outcome.errors.some((error) => error.includes(answer)), `${answer} was refused silently`);
  }
});

test('an edit reaches the world as the correction, not as the original', () => {
  const entry = findCase<Case>(fixture, 'an-edit-is-what-reviewers-actually-want');
  const outcome = go(entry);
  assert.equal(outcome.next, 'act', 'an edit did not act');
  assert.equal(outcome.applied, entry.decision.edit, 'an edit applied the original call');
  assert.notEqual(outcome.applied, entry.spec.sideEffects[0], 'the correction was discarded');
  const empty = go(entry, entry.spec, { ...entry.decision, edit: undefined });
  assert.equal(empty.status, 'rejected', 'an edit with no correction was accepted');
});

test('deny branches to a revision and escalate stops', () => {
  const entry = findCase<Case>(fixture, 'a-denial-carries-an-instruction-and-branches');
  assert.equal(go(entry).next, 'revise', 'a denial ended the run');
  assert.equal(go(entry).applied, null, 'a denial applied something');
  const escalated = go(entry, entry.spec, { answer: 'escalate', atMs: entry.decision.atMs });
  assert.equal(escalated.next, 'halt', 'an escalation kept going');
});

test('only an approval or an edit ever reaches the world', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    if (outcome.applied === null) continue;
    assert.ok(['approve', 'edit'].includes(entry.decision.answer), `${entry.id}: ${entry.decision.answer} acted`);
    assert.equal(outcome.next, 'act', `${entry.id}: something acted without acting`);
  }
});

test('expiry is enforced at the boundary, and staleness is measured', () => {
  const entry = findCase<Case>(fixture, 'an-approval-acts-on-the-one-call-the-gate-holds');
  const window = entry.spec.expiresAfterMs;
  for (const age of [window - 1, window, window + 1, window + 5000]) {
    const outcome = go(entry, entry.spec, { ...entry.decision, atMs: entry.presentedAtMs + age });
    assert.equal(outcome.status === 'rejected', age > window, `an age of ${age} against ${window}`);
    assert.equal(outcome.staleBy, Math.max(0, age - window), `staleBy at ${age}`);
    if (age > window) assert.equal(outcome.next, 'revise', 'a stale decision did not go back');
  }
});

test('a stale decision is never applied, whatever the answer was', () => {
  const entry = findCase<Case>(fixture, 'an-approval-acts-on-the-one-call-the-gate-holds');
  for (const answer of ANSWERS) {
    const late = { answer, atMs: entry.presentedAtMs + entry.spec.expiresAfterMs + 1, reason: 'r', edit: 'e' };
    const outcome = go(entry, entry.spec, late);
    assert.equal(outcome.status, 'rejected', `a stale ${answer} was accepted`);
    assert.equal(outcome.applied, null, `a stale ${answer} reached the world`);
  }
});

test('an expiry longer than the data is volatile for is refused', () => {
  const entry = findCase<Case>(fixture, 'an-approval-acts-on-the-one-call-the-gate-holds');
  const volatility = entry.policy.volatilityMs;
  for (const expiry of [volatility - 1, volatility, volatility + 1]) {
    const outcome = go(entry, { ...entry.spec, expiresAfterMs: expiry });
    assert.equal(outcome.status === 'invalid', expiry > volatility, `expiry ${expiry} against ${volatility}`);
  }
});

test('the risk of the position decides the lane', () => {
  const entry = findCase<Case>(fixture, 'an-approval-acts-on-the-one-call-the-gate-holds');
  for (const position of ['plan', 'execution', 'output', 'exception'] as const) {
    const fast = go(entry, { ...entry.spec, position, lane: 'fast' });
    assert.equal(fast.status === 'invalid', position === 'execution', `${position} in the fast lane`);
    const slow = go(entry, { ...entry.spec, position, lane: 'deliberate' });
    assert.notEqual(slow.status, 'invalid', `${position} was refused the deliberate lane`);
  }
});
