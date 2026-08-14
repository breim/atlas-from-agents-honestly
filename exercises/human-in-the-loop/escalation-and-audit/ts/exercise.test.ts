import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Event, GateSpec, Policy, Result, resolve as ResolveFn } from './start.ts';

interface Case { id: string; spec: GateSpec; event: Event; policy: Policy; result: Result }
interface Fixture { chapter: string; policy: Policy; cases: Case[] }

const fixture = expected<Fixture>(import.meta.url);
const { resolve } = await loadImpl<{ resolve: typeof ResolveFn }>(import.meta.url);
const go = (entry: Case, spec = entry.spec, event = entry.event, policy = entry.policy) => resolve(spec, event, policy);
const SILENT = ['timeout', 'error', 'missing-payload'] as const;

const cases: Array<[string, string]> = [
  ['an-approval-is-recorded-with-the-card-the-reviewer-saw', 'bytes, not a reference'],
  ['a-judgement-denial-does-not-go-back-in-the-queue', 'somebody decided'],
  ['silence-denies-and-routes-to-a-human', 'never ask again'],
  ['an-error-fails-closed-rather-than-approving', 'fail closed'],
  ['a-missing-payload-fails-closed-too', 'the same answer for every fault'],
  ['a-gate-that-approves-on-silence-is-refused', 'failing open is not a policy'],
  ['a-gate-with-no-backup-is-an-undefined-state', 'who is the backup'],
  ['a-gate-that-never-expires-is-an-undefined-state', 'when does it expire'],
  ['a-record-without-the-rendered-card-proves-nothing', 'a reference proves nothing'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(go(entry), entry.result);
  });
}

test('nothing but an explicit approval is ever approved', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    if (outcome.outcome !== 'approved') continue;
    assert.equal(entry.event.kind, 'answered', `${entry.id}: ${entry.event.kind} produced an approval`);
    assert.equal(entry.event.answer, 'approve', `${entry.id}: a non-approval was approved`);
  }
});

test('every way of not answering fails closed and escalates', () => {
  const entry = findCase<Case>(fixture, 'an-approval-is-recorded-with-the-card-the-reviewer-saw');
  for (const kind of SILENT) {
    const outcome = go(entry, entry.spec, { kind, atMs: 1000, card: 'c' });
    assert.equal(outcome.outcome, 'denied', `${kind} did not fail closed`);
    assert.equal(outcome.queued, true, `${kind} denied without escalating`);
    assert.ok(outcome.record !== null, `${kind} recorded nothing`);
  }
});

test('an auto-denial routes to a human and a judgement denial does not', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    if (outcome.record === null) continue;
    const owed = outcome.outcome === 'denied' && outcome.record.denialKind !== 'judgement';
    assert.equal(outcome.queued, owed, `${entry.id}: queued wrongly`);
    if (outcome.outcome === 'approved') assert.equal(outcome.queued, false, `${entry.id}: an approval queued`);
  }
});

test('a timeout denial and a judgement denial are told apart', () => {
  const entry = findCase<Case>(fixture, 'a-judgement-denial-does-not-go-back-in-the-queue');
  const judged = go(entry);
  const timedOut = go(entry, entry.spec, { kind: 'timeout', atMs: 700000, card: 'c' });
  assert.equal(judged.record!.denialKind, 'judgement');
  assert.equal(timedOut.record!.denialKind, 'timeout');
  assert.notEqual(judged.queued, timedOut.queued, 'both denials were handled the same way');
});

test('an approval never carries a denial kind, and a denial always does', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    if (!outcome.record) continue;
    assert.equal(outcome.record.denialKind === null, outcome.outcome === 'approved', `${entry.id}: denial kind`);
  }
});

test('an undefined gate records nothing at all', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    if (outcome.status !== 'undefined-gate') continue;
    assert.equal(outcome.record, null, `${entry.id}: an undefined gate wrote a record`);
    assert.equal(outcome.outcome, 'none', `${entry.id}: an undefined gate decided`);
    assert.equal(outcome.queued, false, entry.id);
  }
});

test('each of the three questions is required on its own', () => {
  const entry = findCase<Case>(fixture, 'an-approval-is-recorded-with-the-card-the-reviewer-saw');
  for (const field of ['onSilence', 'backup', 'expiresAfterMs'] as const) {
    const outcome = go(entry, { ...entry.spec, [field]: null });
    assert.equal(outcome.status, 'undefined-gate', `a gate with no ${field} was accepted`);
    assert.ok(outcome.errors.length > 0, `${field} was refused silently`);
  }
});

test('approving on silence is refused however the rest is configured', () => {
  const entry = findCase<Case>(fixture, 'an-approval-is-recorded-with-the-card-the-reviewer-saw');
  const open = go(entry, { ...entry.spec, onSilence: 'approve' });
  assert.equal(open.status, 'undefined-gate', 'a gate that fails open was accepted');
  assert.ok(open.errors.some((error) => error.includes('fails open')), 'it was refused without saying why');
  const closed = go(entry, { ...entry.spec, onSilence: 'deny' });
  assert.equal(closed.status, 'recorded', 'a gate that fails closed was refused');
});

test('a record with no rendered card is flagged even when the outcome stands', () => {
  const entry = findCase<Case>(fixture, 'a-record-without-the-rendered-card-proves-nothing');
  const outcome = go(entry);
  assert.equal(outcome.status, 'recorded', 'the decision was discarded rather than flagged');
  assert.equal(outcome.record!.card, '', 'a card was invented');
  assert.ok(outcome.errors.some((error) => error.includes('card')), 'the missing card was not reported');
  const withCard = go(entry, entry.spec, { ...entry.event, card: 'bytes' });
  assert.deepEqual(withCard.errors, [], 'a recorded card still complained');
});

test('every record names a reviewer, falling back to the declared backup', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    if (!outcome.record) continue;
    assert.equal(outcome.record.reviewer, entry.event.reviewer ?? entry.spec.backup, `${entry.id}: reviewer`);
    assert.ok(outcome.record.reviewer.length > 0, `${entry.id}: a record names nobody`);
    assert.ok(outcome.record.reasoning.length > 0, `${entry.id}: a record explains nothing`);
    assert.ok(['hard', 'soft'].includes(outcome.record.control), `${entry.id}: the control was not classified`);
  }
});

test('retention is capped, whatever the policy asks for', () => {
  const entry = findCase<Case>(fixture, 'an-approval-is-recorded-with-the-card-the-reviewer-saw');
  const cap = entry.policy.maxRetentionDays;
  for (const asked of [30, cap - 1, cap, cap + 1, 100_000]) {
    const outcome = go(entry, entry.spec, entry.event, { ...entry.policy, retentionDays: asked });
    assert.equal(outcome.record!.retentionDays, Math.min(asked, cap), `retention of ${asked} against ${cap}`);
    assert.ok(outcome.record!.retentionDays <= cap, 'keep-forever was accepted');
  }
});
