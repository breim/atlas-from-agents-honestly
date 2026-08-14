import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Policy, Report, Run, Store, inspect as InspectFn } from './start.ts';

interface Case { id: string; stores: Store[]; run: Run; policy: Policy; result: Report }
interface Fixture { chapter: string; policy: Policy; cases: Case[] }

const fixture = expected<Fixture>(import.meta.url);
const { inspect } = await loadImpl<{ inspect: typeof InspectFn }>(import.meta.url);
const go = (entry: Case, stores = entry.stores, run = entry.run, policy = entry.policy) => inspect(stores, run, policy);

const cases: Array<[string, string]> = [
  ['every-store-isolated-and-inventoried-is-clean', 'three layers, all present'],
  ['securing-the-index-and-forgetting-the-trace-still-leaks', 'the part everyone does'],
  ['a-store-nobody-inventoried-is-a-finding', 'checked in CI, not remembered'],
  ['a-key-accepted-from-the-caller-is-an-authorization-decision-delegated', 'derive, do not accept'],
  ['a-shared-store-scoped-outside-the-transaction-is-load-dependent', 'the pooled connection'],
  ['three-partial-decision-points-have-the-security-of-the-weakest', 'one decision point or none'],
  ['a-step-carrying-another-tenant-is-refused', 'the run identity decides'],
  ['a-step-that-lost-its-tenant-across-a-boundary-is-refused', 'survive the boundary'],
  ['a-resumption-on-another-machine-must-re-derive-the-key', 'retries on other machines'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(go(entry), entry.result);
  });
}

test('securing one store secures nothing on its own', () => {
  const entry = findCase<Case>(fixture, 'every-store-isolated-and-inventoried-is-clean');
  for (const store of entry.stores) {
    const weakened = entry.stores.map((item) =>
      item.name === store.name ? item : { ...item, engineEnforced: false },
    );
    const outcome = go(entry, weakened);
    assert.equal(outcome.status, 'leaking', `securing only ${store.name} was called isolated`);
  }
});

test('every store kind the policy names must be engine-enforced', () => {
  const entry = findCase<Case>(fixture, 'every-store-isolated-and-inventoried-is-clean');
  for (const store of entry.stores) {
    const relaxed = entry.stores.map((item) =>
      item.name === store.name ? { ...item, engineEnforced: false } : item,
    );
    const outcome = go(entry, relaxed);
    const owed = entry.policy.requireEngineEnforcement.includes(store.kind);
    assert.equal(outcome.status === 'leaking', owed, `${store.name} (${store.kind}) was judged wrongly`);
    if (owed) assert.ok(outcome.findings.some((finding) => finding.startsWith(store.name)), `${store.name} unnamed`);
  }
});

test('the agent-specific stores are held to the same rule as the index', () => {
  const entry = findCase<Case>(fixture, 'every-store-isolated-and-inventoried-is-clean');
  const agentStores = entry.stores.filter((store) => store.kind !== 'index');
  assert.ok(agentStores.length >= 5, 'the fixture no longer covers the agent-specific stores');
  for (const store of agentStores) {
    assert.ok(
      entry.policy.requireEngineEnforcement.includes(store.kind),
      `${store.kind} is exempt from engine enforcement`,
    );
  }
});

test('a key accepted from the caller is a finding wherever it happens', () => {
  const entry = findCase<Case>(fixture, 'every-store-isolated-and-inventoried-is-clean');
  for (const store of entry.stores) {
    const outcome = go(entry, entry.stores.map((item) => (item.name === store.name ? { ...item, keyDerived: false } : item)));
    assert.equal(outcome.status, 'leaking', `${store.name} accepted its key and passed`);
    assert.ok(outcome.findings.some((finding) => finding.includes('accepts its key')), `${store.name} unnamed`);
  }
});

test('a shared store is only safe when the tenant is scoped to the transaction', () => {
  const entry = findCase<Case>(fixture, 'every-store-isolated-and-inventoried-is-clean');
  for (const separation of ['per-tenant', 'shared'] as const) {
    for (const scopedToTransaction of [true, false]) {
      const stores = entry.stores.map((item) =>
        item.name === 'chunks' ? { ...item, separation, scopedToTransaction } : item,
      );
      const outcome = go(entry, stores);
      const owed = separation === 'shared' && !scopedToTransaction;
      assert.equal(
        outcome.findings.some((finding) => finding.includes('outside the transaction')),
        owed,
        `${separation}/${scopedToTransaction}`,
      );
    }
  }
});

test('more than one decision point is a finding, and exactly one is not', () => {
  const entry = findCase<Case>(fixture, 'every-store-isolated-and-inventoried-is-clean');
  for (const decisionPoints of [0, 1, 2, 3]) {
    const outcome = go(entry, entry.stores, entry.run, { ...entry.policy, decisionPoints });
    assert.equal(
      outcome.findings.some((finding) => finding.includes('decision points')),
      decisionPoints > 1,
      `${decisionPoints} decision points`,
    );
  }
});

test('a step is read only when its tenant is the run tenant', () => {
  const entry = findCase<Case>(fixture, 'every-store-isolated-and-inventoried-is-clean');
  for (const tenantId of ['meridian', 'northwind', null]) {
    const outcome = go(entry, entry.stores, {
      ...entry.run,
      steps: [{ store: 'chunks', tenantId, onResume: false }],
    });
    assert.equal(outcome.reads[0].allowed, tenantId === entry.run.tenantId, `tenant ${tenantId}`);
    if (tenantId !== entry.run.tenantId) assert.ok(outcome.reads[0].reason, 'refused without a reason');
  }
});

test('a resumed step on another machine must derive its key', () => {
  const entry = findCase<Case>(fixture, 'every-store-isolated-and-inventoried-is-clean');
  for (const keyDerived of [true, false]) {
    for (const resumedOnAnotherMachine of [true, false]) {
      const stores = entry.stores.map((item) => (item.name === 'chunks' ? { ...item, keyDerived } : item));
      const run = {
        ...entry.run,
        resumedOnAnotherMachine,
        steps: [{ store: 'chunks', tenantId: entry.run.tenantId, onResume: true }],
      };
      const outcome = go(entry, stores, run);
      const owed = !(resumedOnAnotherMachine && !keyDerived);
      assert.equal(outcome.reads[0].allowed, owed, `derived ${keyDerived} / resumed ${resumedOnAnotherMachine}`);
    }
  }
});

test('a leak in the reads is a leak even when every store is configured well', () => {
  const entry = findCase<Case>(fixture, 'a-step-carrying-another-tenant-is-refused');
  const outcome = go(entry);
  assert.deepEqual(outcome.findings, [], 'the fixture no longer separates configuration from the read');
  assert.equal(outcome.status, 'leaking', 'a cross-tenant read was called isolated');
});

test('the layer counts describe the three layers honestly', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    assert.equal(outcome.layers.application, entry.stores.length, `${entry.id}: application layer`);
    assert.equal(
      outcome.layers.separation,
      entry.stores.filter((store) => store.separation === 'per-tenant').length,
      `${entry.id}: separation layer`,
    );
    assert.equal(
      outcome.layers.engine,
      entry.stores.filter((store) => store.engineEnforced).length,
      `${entry.id}: engine layer`,
    );
    assert.ok(outcome.layers.separation <= outcome.layers.application, `${entry.id}: impossible counts`);
  }
});

test('every store outside the inventory is named', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    assert.deepEqual(
      outcome.uninventoried,
      entry.stores.filter((store) => !store.inInventory).map((store) => store.name),
      `${entry.id}: the inventory check is wrong`,
    );
    for (const name of outcome.uninventoried) {
      assert.ok(outcome.findings.some((finding) => finding.startsWith(name)), `${name} was not reported`);
    }
  }
});
