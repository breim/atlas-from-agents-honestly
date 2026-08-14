import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Config, Plan, Request, plan as PlanFn } from './start.ts';

interface Case {
  id: string;
  ownership?: Record<string, string[]>;
  request: Request;
  result: Plan;
}

const fixture = expected<{ chapter: string; config: Config; cases: Case[] }>(import.meta.url);
const { plan } = await loadImpl<{ plan: typeof PlanFn }>(import.meta.url);

const configFor = (entry: Case, overrides: Partial<Config> = {}): Config => ({
  ...fixture.config,
  ...(entry.ownership ? { ownership: entry.ownership } : {}),
  ...overrides,
});
const run = (entry: Case, request = entry.request, overrides: Partial<Config> = {}) =>
  plan(request, configFor(entry, overrides));
const ownersFor = (entry: Case) => configFor(entry).ownership[entry.request.failureClass] ?? [];

const cases: Array<[string, string]> = [
  ['one-owner-per-class-means-no-multiplication', 'one layer owns the recovery'],
  ['three-owners-multiply-to-twenty-seven', 'nested retries multiply, never add'],
  ['the-model-is-a-layer-nobody-configured', 'not in the config, in the traffic'],
  ['a-permanent-failure-is-retried-nowhere', 'the same rejection, billed again'],
  ['the-call-timeout-is-the-smaller-of-its-own-and-what-remains', 'per-call timeouts do not compose'],
  ['a-generous-remainder-does-not-lengthen-a-call', 'a budget is a ceiling, not a target'],
  ['a-passed-deadline-admits-nothing', 'the user gave up ninety seconds ago'],
  ['the-attempt-ceiling-belongs-to-the-run', 'not sixty attempts nobody reasoned about'],
  ['an-exhausted-retry-budget-fails-through', 'retrying converts one failure into three'],
  ['a-budget-exactly-at-the-line-is-spent', 'the boundary is spent, not spare'],
  ['no-traffic-yet-admits-the-first-retry', 'an empty window is not an exhausted one'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('a layer that does not own the class gets exactly one attempt', () => {
  for (const entry of fixture.cases) {
    const owners = ownersFor(entry);
    for (const layer of run(entry).layers) {
      if (owners.includes(layer.name)) continue;
      assert.equal(layer.attempts, 1, `${entry.id}: ${layer.name} retried a class it does not own`);
    }
  }
});

test('an owning layer keeps the attempts it was configured with', () => {
  for (const entry of fixture.cases) {
    const configured = new Map(fixture.config.layers.map((layer) => [layer.name, layer.attempts]));
    for (const layer of run(entry).layers) {
      if (!ownersFor(entry).includes(layer.name)) continue;
      assert.equal(layer.attempts, configured.get(layer.name), `${entry.id}: ${layer.name} lost its policy`);
    }
  }
});

test('the total is the product of every layer, including the one nobody configured', () => {
  for (const entry of fixture.cases) {
    const { layers, totalCalls } = run(entry);
    const product = layers.reduce((total, layer) => total * layer.attempts, 1) * entry.request.modelRetries;
    assert.equal(totalCalls, product, `${entry.id}: the arithmetic does not multiply`);
  }
});

test('collapsing every configured layer cannot bound the model', () => {
  for (const entry of fixture.cases) {
    const collapsed = run(entry, entry.request, { ownership: {} });
    assert.ok(collapsed.totalCalls >= entry.request.modelRetries, entry.id);
    const chattier = run(entry, { ...entry.request, modelRetries: entry.request.modelRetries + 1 }, { ownership: {} });
    assert.ok(chattier.totalCalls > collapsed.totalCalls, `${entry.id}: the fourth layer was bounded`);
  }
});

test('a second owner never lowers the number of calls', () => {
  for (const entry of fixture.cases) {
    const before = run(entry);
    const everyone = { [entry.request.failureClass]: fixture.config.layers.map((layer) => layer.name) };
    const after = run(entry, entry.request, { ownership: everyone });
    assert.ok(after.totalCalls >= before.totalCalls, `${entry.id}: adding an owner reduced traffic`);
    assert.equal(after.multiplied, fixture.config.layers.length > 1, entry.id);
  }
});

test('a call never gets more time than it asked for, or than the run has left', () => {
  for (const entry of fixture.cases) {
    const { timeoutMs } = run(entry);
    assert.ok(timeoutMs <= entry.request.preferredTimeoutMs, `${entry.id}: the call outgrew its own timeout`);
    assert.ok(timeoutMs <= entry.request.remainingMs, `${entry.id}: the call outlived the run`);
  }
});

test('a call always leaves room for the run to finish', () => {
  for (const entry of fixture.cases) {
    const { timeoutMs } = run(entry);
    if (entry.request.remainingMs <= 0) {
      assert.equal(timeoutMs, 0, entry.id);
      continue;
    }
    const reserved = entry.request.remainingMs - timeoutMs;
    assert.ok(reserved >= 0, `${entry.id}: nothing was reserved`);
  }
});

test('a retry is admitted exactly when no reason refuses it', () => {
  for (const entry of fixture.cases) {
    const { retryAdmitted, reason } = run(entry);
    assert.equal(retryAdmitted, reason === null, `${entry.id}: ${reason}`);
  }
});

test('a class nobody owns is never retried, whatever the budget says', () => {
  for (const entry of fixture.cases) {
    const orphan = run(entry, entry.request, { ownership: {} });
    assert.equal(orphan.retryAdmitted, false, `${entry.id}: an unowned class was retried`);
    assert.equal(orphan.reason, 'not_retryable', entry.id);
  }
});

test('a fuller retry window never admits more', () => {
  for (const entry of fixture.cases) {
    const before = run(entry).retryAdmitted;
    const busier = run(entry, { ...entry.request, retriesInWindow: entry.request.callsInWindow });
    assert.ok(!busier.retryAdmitted || before, `${entry.id}: more retries bought more retries`);
  }
});
