import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Policy, Request, Result, Scope, handle as Handle } from './start.ts';

interface Case {
  id: string;
  request: Request;
  result: Result;
}

interface Fixture {
  chapter: string;
  policy: Policy;
  scope: Scope;
  cases: Case[];
}

const fixture = expected<Fixture>(import.meta.url);
const { handle } = await loadImpl<{ handle: typeof Handle }>(import.meta.url);

const run = (request: Request, scope = fixture.scope, policy = fixture.policy) => handle(request, scope, policy);
// The dispatcher's own check, written independently of the broker.
const dispatcherWouldAllow = (request: Request, scope = fixture.scope) => {
  const tool = fixture.policy.catalogue[request.op!];
  if (!tool) return false;
  if (tool.class > scope.maxClass) return false;
  return request.orderId === scope.orderId && request.amountCents! <= scope.capCents;
};

const cases: Array<[string, string]> = [
  ['an-operation-inside-the-scope-is-served', 'an operation, not a secret'],
  ['generated-code-cannot-call-what-the-model-could-not', 'one authorization path'],
  ['an-unknown-operation-is-not-an-operation', 'the list is the interface'],
  ['an-operation-outside-the-argument-scope-is-refused', 'the class was fine; the arguments were not'],
  ['the-same-operation-on-this-order-is-served', 'the same call, correctly aimed'],
  ['there-is-no-way-to-ask-for-a-secret', 'nothing to steal after an escape'],
  ['the-broker-socket-is-the-only-way-out', 'the one allowed path'],
  ['the-package-registry-is-denied-at-runtime', 'installing mid-run is running someone else code'],
  ['an-unexpected-host-is-what-a-successful-injection-looks-like', 'the highest-signal detection here'],
  ['oversized-output-is-truncated-at-the-boundary', 'it becomes prompt text'],
  ['output-exactly-at-the-cap-is-not-truncated', 'the cap is inclusive'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(run(entry.request), entry.result);
  });
}

test('a request for a secret is always refused and always alerts', () => {
  for (const entry of fixture.cases) {
    const asked = run({ ...entry.request, kind: 'secret', name: 'ANY_KEY' });
    assert.deepEqual(
      asked,
      { allowed: false, reason: 'no_such_capability', alerted: true, deliveredBytes: 0, truncated: false },
      `${entry.id}: the sandbox got a credential`,
    );
  }
});

test('the broker never allows an operation the dispatcher would refuse', () => {
  for (const entry of fixture.cases) {
    if (entry.request.kind !== 'op') continue;
    assert.equal(run(entry.request).allowed, dispatcherWouldAllow(entry.request), `${entry.id}: two interfaces`);
  }
});

test('every tool in the catalogue agrees with the dispatcher, at every scope', () => {
  for (const op of Object.keys(fixture.policy.catalogue)) {
    for (const orderId of [fixture.scope.orderId, 'somewhere-else']) {
      const request: Request = { kind: 'op', op, orderId, amountCents: 0, outputBytes: 10 };
      assert.equal(run(request).allowed, dispatcherWouldAllow(request), `${op}/${orderId}`);
    }
  }
});

test('egress is allowed exactly for the hosts on the allowlist', () => {
  for (const host of [...fixture.policy.egressAllow, 'pypi.org', 'attacker.example', '']) {
    const result = run({ kind: 'egress', host, outputBytes: 10 });
    assert.equal(result.allowed, fixture.policy.egressAllow.includes(host), `${host}`);
  }
});

test('an empty allowlist denies everything, including the broker', () => {
  for (const host of fixture.policy.egressAllow) {
    const result = run({ kind: 'egress', host, outputBytes: 10 }, fixture.scope, {
      ...fixture.policy,
      egressAllow: [],
    });
    assert.equal(result.allowed, false, `${host}: the default was not deny`);
    assert.equal(result.alerted, true, host);
  }
});

test('an egress or secret denial alerts, and an authorization denial does not', () => {
  for (const entry of fixture.cases) {
    const { allowed, alerted } = run(entry.request);
    if (allowed) {
      assert.equal(alerted, false, `${entry.id}: an allowed request paged somebody`);
      continue;
    }
    assert.equal(alerted, entry.request.kind !== 'op', `${entry.id}: the wrong denials alert`);
  }
});

test('a denied request delivers nothing at all', () => {
  for (const entry of fixture.cases) {
    const result = run(entry.request);
    if (result.allowed) continue;
    assert.equal(result.deliveredBytes, 0, `${entry.id}: a refusal still returned bytes`);
    assert.equal(result.truncated, false, entry.id);
  }
});

test('nothing ever crosses the boundary above the output cap', () => {
  for (const entry of fixture.cases) {
    for (const outputBytes of [0, 1, fixture.policy.maxOutputBytes, fixture.policy.maxOutputBytes + 1, 10 ** 7]) {
      const result = run({ ...entry.request, outputBytes });
      assert.ok(result.deliveredBytes <= fixture.policy.maxOutputBytes, `${entry.id}: ${outputBytes} got through`);
      if (result.allowed) {
        assert.equal(result.truncated, outputBytes > fixture.policy.maxOutputBytes, `${entry.id}: ${outputBytes}`);
        assert.equal(result.deliveredBytes, Math.min(outputBytes, fixture.policy.maxOutputBytes), entry.id);
      }
    }
  }
});

test('narrowing the scope never allows more', () => {
  for (const entry of fixture.cases) {
    const before = run(entry.request).allowed;
    const narrow: Scope = { maxClass: 0, orderId: 'nothing-matches', capCents: 0 };
    const after = run(entry.request, narrow).allowed;
    if (entry.request.kind === 'op') assert.equal(after, false, `${entry.id}: a closed scope still served`);
    else assert.equal(after, before, `${entry.id}: the scope moved an egress decision`);
  }
});
