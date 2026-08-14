import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Action, Backend, Result, Token, act as ActFn } from './start.ts';

interface Case { id: string; token: Token; action: Action; backends: Backend[]; agentId: string; result: Result }
interface Fixture { chapter: string; cases: Case[] }

const fixture = expected<Fixture>(import.meta.url);
const { act } = await loadImpl<{ act: typeof ActFn }>(import.meta.url);
const go = (entry: Case, token = entry.token, action = entry.action) => act(token, action, entry.backends, entry.agentId);

const cases: Array<[string, string]> = [
  ['a-delegation-names-both-principals-and-is-allowed', 'sub and act'],
  ['a-service-credential-is-the-confused-deputy', 'nothing broken, everything wrong'],
  ['impersonation-authorizes-correctly-and-destroys-accountability', 'the wrong trade'],
  ['a-backend-that-filters-after-reading-was-still-read', 'a display preference'],
  ['a-token-carrying-more-than-the-backend-needs-is-refused', 'downscope on the way in'],
  ['a-run-that-stored-the-token-cannot-re-derive-rights', 'the reference, not the token'],
  ['a-resumed-run-replaying-expired-rights-is-refused', 'a revocation that silently did not happen'],
  ['a-scheduled-run-with-no-human-owner-is-refused', 'a named human owner'],
  ['a-scheduled-run-with-a-named-owner-is-allowed', 'a documented grant'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(go(entry), entry.result);
  });
}

test('a refused action uses no scopes at all', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    if (outcome.status !== 'refused') continue;
    assert.deepEqual(outcome.scopesUsed, [], `${entry.id}: a refusal used scopes`);
    assert.ok(outcome.errors.length > 0, entry.id);
  }
});

test('only delegation is ever allowed', () => {
  const entry = findCase<Case>(fixture, 'a-delegation-names-both-principals-and-is-allowed');
  for (const model of ['service', 'impersonation', 'delegation'] as const) {
    const outcome = go(entry, { ...entry.token, model });
    assert.equal(outcome.status === 'allowed', model === 'delegation', `${model} was judged wrongly`);
  }
});

test('a delegation missing either principal is refused', () => {
  const entry = findCase<Case>(fixture, 'a-delegation-names-both-principals-and-is-allowed');
  for (const field of ['sub', 'act'] as const) {
    const outcome = go(entry, { ...entry.token, [field]: null });
    assert.equal(outcome.status, 'refused', `a delegation with no ${field} was allowed`);
    assert.ok(outcome.errors.some((error) => error.includes('delegation names no')), `${field} unnamed`);
  }
});

test('the token carries exactly the scopes the backend needs, no more and no less', () => {
  const entry = findCase<Case>(fixture, 'a-delegation-names-both-principals-and-is-allowed');
  const backend = entry.backends.find((item) => item.name === entry.action.backend)!;
  const probes: Array<[string[], boolean]> = [
    [backend.requiredScopes, true],
    [[], false],
    [[...backend.requiredScopes, 'hr:read'], false],
    [['hr:read'], false],
  ];
  for (const [scopes, owed] of probes) {
    const outcome = go(entry, { ...entry.token, scopes });
    assert.equal(outcome.status === 'allowed', owed, `scopes ${JSON.stringify(scopes)}`);
  }
});

test('a backend that filters after reading is always refused', () => {
  const entry = findCase<Case>(fixture, 'a-delegation-names-both-principals-and-is-allowed');
  for (const backend of entry.backends) {
    const outcome = go(entry, { ...entry.token, scopes: backend.requiredScopes }, { ...entry.action, backend: backend.name });
    assert.equal(outcome.status === 'refused', backend.filtersOnRead, `${backend.name} was judged wrongly`);
  }
});

test('the run holds a reference and never a token', () => {
  const entry = findCase<Case>(fixture, 'a-delegation-names-both-principals-and-is-allowed');
  const stored = go(entry, entry.token, { ...entry.action, storedToken: 'eyJ...' });
  assert.equal(stored.status, 'refused', 'a stored token was accepted');
  const referenceless = go(entry, entry.token, { ...entry.action, delegationRef: null });
  assert.equal(referenceless.status, 'refused', 'a run with no delegation reference was accepted');
});

test('expiry is checked at the moment of the action, not at the start of the run', () => {
  const entry = findCase<Case>(fixture, 'a-delegation-names-both-principals-and-is-allowed');
  const expiry = entry.token.expiresAtMs;
  for (const atMs of [expiry - 1, expiry, expiry + 1]) {
    const outcome = go(entry, entry.token, { ...entry.action, atMs });
    assert.equal(outcome.status === 'allowed', atMs < expiry, `acting at ${atMs} against an expiry of ${expiry}`);
  }
});

test('a scheduled run needs an owner and an attended one does not', () => {
  const entry = findCase<Case>(fixture, 'a-delegation-names-both-principals-and-is-allowed');
  for (const scheduled of [true, false]) {
    for (const ownerHuman of ['human:mlopes', null]) {
      const outcome = go(entry, entry.token, { ...entry.action, scheduled, ownerHuman });
      assert.equal(outcome.status === 'allowed', !scheduled || ownerHuman !== null, `${scheduled}/${ownerHuman}`);
    }
  }
});

test('every audit line names the user, the agent and the run', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    assert.equal(outcome.log.run, entry.action.runId, `${entry.id}: the run is not named`);
    assert.equal(outcome.log.user, entry.token.sub, `${entry.id}: the user is not the token subject`);
    assert.equal(outcome.log.agent, entry.token.act ?? entry.agentId, `${entry.id}: the agent is wrong`);
    if (outcome.status === 'allowed') {
      for (const value of Object.values(outcome.log)) {
        assert.ok(value, `${entry.id}: an allowed action left part of the audit line empty`);
      }
    }
  }
});

test('an action missing any part of the audit line is refused', () => {
  const entry = findCase<Case>(fixture, 'a-delegation-names-both-principals-and-is-allowed');
  assert.equal(go(entry, { ...entry.token, sub: null }).status, 'refused', 'no user was allowed');
  assert.equal(go(entry, entry.token, { ...entry.action, runId: '' }).status, 'refused', 'no run was allowed');
});
