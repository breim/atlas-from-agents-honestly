import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Audit, Grant, Policy, Run, govern as GovernFn } from './start.ts';

interface Case { id: string; grants: Grant[]; run: Run; policy: Policy; result: Audit }
interface Fixture { chapter: string; policy: Policy; cases: Case[] }

const fixture = expected<Fixture>(import.meta.url);
const { govern } = await loadImpl<{ govern: typeof GovernFn }>(import.meta.url);
const go = (entry: Case, grants = entry.grants, run = entry.run, policy = entry.policy) => govern(grants, run, policy);

const cases: Array<[string, string]> = [
  ['a-tightly-scoped-grant-with-an-in-scope-call-is-clean', 'six axes, not one'],
  ['an-unused-grant-is-reachable-now-that-a-model-chooses', 'latent is no longer latent'],
  ['a-grant-scoped-only-by-tool-is-a-finding', 'most implementations use only the second'],
  ['a-per-call-cap-without-a-per-run-cap-misses-the-slow-attack', 'twenty small credits'],
  ['twenty-small-credits-are-stopped-by-the-aggregate-cap', 'the aggregate holds'],
  ['a-write-bound-to-an-entity-not-in-scope-is-refused', 'from your records, not the arguments'],
  ['a-tool-that-appeared-after-the-audit-is-denied-by-default', 'a dynamic catalogue'],
  ['unattended-execution-is-a-permission-the-task-did-not-need', 'least agency'],
  ['a-standing-credential-cannot-answer-which-run-caused-what', 'the run id in the token'],
  ['shadow-mode-measures-the-policy-without-blocking-anything', 'a week before turning it on'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(go(entry), entry.result);
  });
}

test('every unused grant is a finding, one at a time', () => {
  const entry = findCase<Case>(fixture, 'a-tightly-scoped-grant-with-an-in-scope-call-is-clean');
  for (const grant of entry.grants) {
    const stale = entry.grants.map((item) =>
      item.tool === grant.tool ? { ...item, usedInLast90Days: false } : item,
    );
    const outcome = go(entry, stale);
    assert.equal(outcome.status, 'findings', `${grant.tool} was unused and not reported`);
    assert.ok(outcome.findings.some((finding) => finding.startsWith(grant.tool)), `${grant.tool} unnamed`);
  }
});

test('every required scope is required, one missing at a time', () => {
  const entry = findCase<Case>(fixture, 'a-tightly-scoped-grant-with-an-in-scope-call-is-clean');
  for (const scope of entry.policy.requiredScopes) {
    const narrowed = entry.grants.map((grant) => ({
      ...grant,
      argumentScopes: grant.argumentScopes.filter((item) => item !== scope),
    }));
    const outcome = go(entry, narrowed);
    assert.equal(outcome.status, 'findings', `a grant unscoped by ${scope} was accepted`);
    assert.ok(outcome.findings.some((finding) => finding.includes(scope)), `${scope} unnamed`);
  }
});

test('a call is allowed only when its entity is already in scope for the run', () => {
  const entry = findCase<Case>(fixture, 'a-tightly-scoped-grant-with-an-in-scope-call-is-clean');
  for (const entity of ['order:4921', 'order:9999', 'account:4471']) {
    const outcome = go(entry, entry.grants, {
      ...entry.run,
      calls: [{ tool: 'issue_credit', entity, amountCents: 1000 }],
    });
    const owed = entry.run.entitiesInScope.includes(entity);
    assert.equal(outcome.decisions[0].allowed, owed, `${entity} was judged wrongly`);
    assert.equal(outcome.spentCents, owed ? 1000 : 0, `${entity}: spend`);
  }
});

test('the aggregate cap stops what per-call caps let through', () => {
  const entry = findCase<Case>(fixture, 'twenty-small-credits-are-stopped-by-the-aggregate-cap');
  const grant = entry.grants.find((item) => item.tool === 'issue_credit')!;
  const outcome = go(entry);
  for (const call of entry.run.calls) {
    assert.ok(call.amountCents <= (grant.maxPerCall as number), 'the fixture no longer hides under the per-call cap');
  }
  assert.ok(outcome.blocked > 0, 'the aggregate cap let everything through');
  assert.ok(outcome.spentCents <= (grant.maxPerRun as number), 'the run spent past its aggregate cap');
});

test('spend never exceeds the aggregate cap, however the calls are split', () => {
  const entry = findCase<Case>(fixture, 'twenty-small-credits-are-stopped-by-the-aggregate-cap');
  const grant = entry.grants.find((item) => item.tool === 'issue_credit')!;
  for (const size of [10_000, 50_000, 150_000, 199_999]) {
    const calls = Array.from({ length: 40 }, () => ({ tool: 'issue_credit', entity: 'order:4921', amountCents: size }));
    const outcome = go(entry, entry.grants, { ...entry.run, calls });
    assert.ok(outcome.spentCents <= (grant.maxPerRun as number), `${size}-cent calls spent past the cap`);
  }
});

test('a newly appeared tool is denied even when everything else is fine', () => {
  const entry = findCase<Case>(fixture, 'a-tool-that-appeared-after-the-audit-is-denied-by-default');
  const outcome = go(entry);
  const call = entry.run.calls.findIndex((item) => item.tool === 'new_tool');
  assert.equal(outcome.decisions[call].allowed, false, 'a newly appeared tool was allowed');
  assert.ok(outcome.findings.some((finding) => finding.includes('new_tool')), 'it was denied without a finding');
});

test('unattended is a finding only when the run is not attended', () => {
  const entry = findCase<Case>(fixture, 'a-tightly-scoped-grant-with-an-in-scope-call-is-clean');
  for (const unattended of [true, false]) {
    for (const attended of [true, false]) {
      const grants = entry.grants.map((grant) => ({ ...grant, unattended }));
      const outcome = go(entry, grants, { ...entry.run, attended });
      const owed = unattended && !attended;
      assert.equal(
        outcome.findings.some((finding) => finding.includes('unattended')),
        owed,
        `unattended ${unattended} on an attended ${attended} run`,
      );
    }
  }
});

test('a denial escalates whether or not it blocks', () => {
  for (const entry of fixture.cases) {
    for (const mode of ['shadow', 'enforce'] as const) {
      const outcome = go(entry, entry.grants, entry.run, { ...entry.policy, mode });
      const refused = go(entry, entry.grants, entry.run, { ...entry.policy, mode: 'enforce' }).decisions.filter(
        (decision) => !decision.allowed,
      ).length;
      assert.equal(outcome.escalated, refused, `${entry.id}/${mode}: escalation follows the policy, not the mode`);
      assert.equal(outcome.blocked, mode === 'shadow' ? 0 : refused, `${entry.id}/${mode}: blocking`);
    }
  }
});

test('shadow mode changes what is blocked and nothing else', () => {
  const entry = findCase<Case>(fixture, 'shadow-mode-measures-the-policy-without-blocking-anything');
  const shadow = go(entry, entry.grants, entry.run, { ...entry.policy, mode: 'shadow' });
  const enforce = go(entry, entry.grants, entry.run, { ...entry.policy, mode: 'enforce' });
  assert.deepEqual(shadow.findings, enforce.findings, 'the mode moved the findings');
  assert.equal(shadow.escalated, enforce.escalated, 'the mode moved the escalations');
  assert.equal(shadow.blocked, 0, 'shadow mode blocked something');
  assert.ok(enforce.blocked > 0, 'the fixture no longer refuses anything');
  assert.ok(shadow.decisions.every((decision) => decision.allowed), 'shadow mode refused a call');
});

test('a standing credential is always a finding', () => {
  for (const entry of fixture.cases) {
    for (const credential of ['standing', 'run-scoped'] as const) {
      const outcome = go(entry, entry.grants, { ...entry.run, credential });
      assert.equal(
        outcome.findings.some((finding) => finding.includes('standing credential')),
        credential === 'standing',
        `${entry.id}: ${credential}`,
      );
    }
  }
});

test('a refused call never spends and never stops the ones behind it', () => {
  const entry = findCase<Case>(fixture, 'a-tightly-scoped-grant-with-an-in-scope-call-is-clean');
  const calls = [
    { tool: 'issue_credit', entity: 'order:9999', amountCents: 1000 },
    { tool: 'issue_credit', entity: 'order:4921', amountCents: 2000 },
  ];
  const outcome = go(entry, entry.grants, { ...entry.run, calls });
  assert.equal(outcome.decisions[0].allowed, false, 'an out-of-scope call was allowed');
  assert.equal(outcome.decisions[1].allowed, true, 'a refusal stopped a legitimate call behind it');
  assert.equal(outcome.spentCents, 2000, 'a refused call spent something');
});
