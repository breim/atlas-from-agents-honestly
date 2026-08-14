import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Authorized, Request, Token, authorize as Authorize } from './start.ts';

interface Case {
  id: string;
  now: number;
  token: Token;
  request: Request;
  result: Authorized;
}

const fixture = expected<{ chapter: string; cases: Case[] }>(import.meta.url);
const { authorize } = await loadImpl<{ authorize: typeof Authorize }>(import.meta.url);

const run = (entry: Case) => authorize(entry.token, entry.request, entry.now);

const cases: Array<[string, string]> = [
  ['a-bound-token-with-the-right-scope-is-accepted', 'a valid, bound, scoped token passes'],
  ['a-token-issued-for-another-server-is-rejected', 'the confused deputy is refused at the door'],
  ['an-expired-token-is-rejected', 'a lapsed token is not a credential'],
  ['a-token-expiring-exactly-now-is-rejected', 'the expiry boundary is closed'],
  ['expiry-is-reported-before-the-audience', 'the check order is fixed'],
  ['the-audience-is-reported-before-the-scope', 'binding is checked before permission'],
  ['a-read-scope-does-not-grant-a-write', 'reading an invoice is not crediting one'],
  ['a-token-with-no-scopes-grants-nothing', 'authenticated is not authorized'],
  ['a-token-with-several-scopes-grants-each-of-them', 'each granted scope is usable'],
  ['the-requester-comes-from-the-token-not-the-arguments', 'the model does not choose the requester'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('an accepted call always reports the token subject', () => {
  for (const entry of fixture.cases) {
    const result = run(entry);
    if (!result.ok) continue;
    assert.equal(result.subject, entry.token.subject, `${entry.id}: the requester came from elsewhere`);
  }
});

test('a rejected call never reports a subject', () => {
  for (const entry of fixture.cases) {
    const result = run(entry);
    if (result.ok) continue;
    assert.ok(!('subject' in result), `${entry.id}: a refusal named a requester`);
  }
});

test('an argument naming another subject never changes the answer', () => {
  for (const entry of fixture.cases) {
    const forged = { ...entry.request, argumentSubject: 'attacker' };
    assert.deepEqual(authorize(entry.token, forged, entry.now), run(entry), entry.id);
  }
});

test('a token is never accepted for a resource other than its audience', () => {
  for (const entry of fixture.cases) {
    const elsewhere = { ...entry.request, resource: 'mcp.somewhere-else.example' };
    const result = authorize(entry.token, elsewhere, entry.now);
    assert.equal(result.ok, false, `${entry.id}: the token was replayed against another server`);
  }
});

test('every accepted call asked for a scope the token carries', () => {
  for (const entry of fixture.cases) {
    if (!run(entry).ok) continue;
    assert.ok(entry.token.scopes.includes(entry.request.scope), `${entry.id}: granted an unheld scope`);
  }
});

test('removing the granted scope turns every acceptance into a refusal', () => {
  for (const entry of fixture.cases) {
    if (!run(entry).ok) continue;
    const narrowed = { ...entry.token, scopes: entry.token.scopes.filter((s) => s !== entry.request.scope) };
    assert.deepEqual(authorize(narrowed, entry.request, entry.now), { ok: false, error: 'missing_scope' }, entry.id);
  }
});

test('waiting past the expiry turns every acceptance into a refusal', () => {
  for (const entry of fixture.cases) {
    if (!run(entry).ok) continue;
    const later = authorize(entry.token, entry.request, entry.token.expiresAt);
    assert.deepEqual(later, { ok: false, error: 'expired' }, `${entry.id}: an expired token still passed`);
  }
});

test('a token that is expired is refused whatever else it carries', () => {
  for (const entry of fixture.cases) {
    const token = { ...entry.token, audience: entry.request.resource, scopes: [entry.request.scope] };
    const result = authorize(token, entry.request, token.expiresAt + 1);
    assert.deepEqual(result, { ok: false, error: 'expired' }, entry.id);
  }
});
