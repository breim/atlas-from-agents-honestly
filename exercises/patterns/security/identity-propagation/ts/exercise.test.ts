import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Act, Principal, act as ActFn } from './start.ts';

interface Case {
  id: string;
  user: Principal | null;
  need: string;
  verdict: Act;
}

const fixture = expected<{ chapter: string; service: Principal; cases: Case[] }>(import.meta.url);
const { act } = await loadImpl<{ act: typeof ActFn }>(import.meta.url);

const run = (entry: Case) => act(entry.user, entry.need, fixture.service);

const cases: Array<[string, string]> = [
  ['a-scope-both-hold-is-propagated', 'the intersection lets the call through'],
  ['a-scope-only-the-service-holds-is-refused', "the agent's own reach is not the user's"],
  ['a-scope-only-the-user-holds-is-refused', 'least privilege applies to the agent too'],
  ['the-effective-scope-is-the-intersection', "neither party's list is the answer alone"],
  ['an-anonymous-call-is-refused', 'no identity fails closed'],
  ['a-user-with-no-scopes-can-do-nothing', 'an empty scope list is not a wildcard'],
  ['the-acting-principal-is-always-the-user', 'the audit trail names the person'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.verdict);
  });
}

test('the service account is never the acting principal', () => {
  for (const entry of fixture.cases) {
    assert.notEqual(
      run(entry).principal,
      fixture.service.principal,
      `${entry.id}: acted as the service account`,
    );
  }
});

test('nothing is allowed outside the intersection', () => {
  for (const entry of fixture.cases) {
    if (!run(entry).allowed) continue;
    assert.ok(entry.user!.scopes.includes(entry.need), `${entry.id}: outside the user's scopes`);
    assert.ok(
      fixture.service.scopes.includes(entry.need),
      `${entry.id}: outside the service's scopes`,
    );
  }
});

test('every scope in the intersection is allowed, and nothing else is', () => {
  const user: Principal = { principal: 'dana', scopes: ['orders:read', 'admin', 'nope'] };
  const universe = [...new Set([...user.scopes, ...fixture.service.scopes])];
  for (const need of universe) {
    const both = user.scopes.includes(need) && fixture.service.scopes.includes(need);
    assert.equal(act(user, need, fixture.service).allowed, both, `${need} was judged wrongly`);
  }
});

test('an allowed call carries no reason and a refusal always does', () => {
  for (const entry of fixture.cases) {
    const { allowed, reason } = run(entry);
    if (allowed) assert.equal(reason, null, `${entry.id}`);
    else assert.ok(reason, `${entry.id}: refused without a reason`);
  }
});
