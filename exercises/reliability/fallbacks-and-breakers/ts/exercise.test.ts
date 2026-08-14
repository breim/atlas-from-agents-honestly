import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Request, Rung, Served, serve as Serve } from './start.ts';

interface Case {
  id: string;
  tier: number;
  open: string[];
  behaviour: Request['behaviour'];
  result: Served;
}

const fixture = expected<{ chapter: string; ladder: Rung[]; cases: Case[] }>(import.meta.url);
const { serve } = await loadImpl<{ serve: typeof Serve }>(import.meta.url);

const requestOf = (entry: Case, overrides: Partial<Request> = {}): Request => ({
  tier: entry.tier,
  open: entry.open,
  behaviour: entry.behaviour,
  ...overrides,
});
const run = (entry: Case, overrides: Partial<Request> = {}) => serve(requestOf(entry, overrides), fixture.ladder);
const rungOf = (name: string) => fixture.ladder.find((rung) => rung.name === name)!;

const cases: Array<[string, string]> = [
  ['the-primary-answers-and-nothing-degrades', 'the ordinary path'],
  ['a-transient-failure-walks-down-the-ladder', 'and the response says so'],
  ['an-open-breaker-is-skipped-without-being-tried', 'a dependency you believe is broken'],
  ['a-refusal-does-not-shop-for-another-provider', 'that is not what a fallback is for'],
  ['a-malformed-request-fails-again-everywhere', 'the second attempt is the first attempt'],
  ['high-stakes-work-is-not-allowed-to-degrade', 'escalate rather than accept the cheap rung'],
  ['tier-zero-work-may-use-the-cheap-rungs', 'the same failures, a different answer'],
  ['the-rungs-that-need-nobody-elses-capacity', 'everyone secondary is the same secondary'],
  ['only-a-person-can-take-the-highest-tier', 'the rung available at any tier'],
  ['an-exhausted-ladder-is-an-escalation-not-a-500', 'a person is a correct outcome'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('a rung with an open breaker is never called', () => {
  for (const entry of fixture.cases) {
    const { attempted, skipped } = run(entry);
    for (const name of entry.open) {
      assert.ok(!attempted.includes(name), `${entry.id}: ${name} was called with its breaker open`);
      if (skipped.some((entry_) => entry_.name === name)) {
        assert.ok(skipped.find((entry_) => entry_.name === name)!.why === 'breaker_open', entry.id);
      }
    }
  }
});

test('a rung is never called above the tier it may serve', () => {
  for (const entry of fixture.cases) {
    for (const name of run(entry).attempted) {
      assert.ok(rungOf(name).maxTier >= entry.tier, `${entry.id}: ${name} served a tier it may not`);
    }
  }
});

test('the serving rung could serve this tier', () => {
  for (const entry of fixture.cases) {
    const { servedBy } = run(entry);
    if (servedBy === null) continue;
    assert.ok(rungOf(servedBy).maxTier >= entry.tier, `${entry.id}: ${servedBy} degraded high-stakes work`);
  }
});

test('degraded is true exactly when something other than the first rung answered', () => {
  for (const entry of fixture.cases) {
    const { servedBy, degraded } = run(entry);
    assert.equal(degraded, servedBy !== null && servedBy !== fixture.ladder[0].name, entry.id);
  }
});

test('a non-transient failure halts the ladder where it happened', () => {
  for (const entry of fixture.cases) {
    const { outcome, attempted, error } = run(entry);
    if (outcome !== 'halted') continue;
    const last = attempted[attempted.length - 1];
    assert.equal(entry.behaviour[last], error, `${entry.id}: the wrong failure was reported`);
    const index = fixture.ladder.findIndex((rung) => rung.name === last);
    for (const rung of fixture.ladder.slice(index + 1)) {
      assert.ok(!attempted.includes(rung.name), `${entry.id}: ${rung.name} was tried after a refusal`);
    }
  }
});

test('a refusal at the first rung is never turned into a fallback', () => {
  for (const entry of fixture.cases) {
    for (const failure of ['policy', 'permanent'] as const) {
      const refused = run(entry, { open: [], behaviour: { ...entry.behaviour, primary: failure } });
      if (entry.tier > fixture.ladder[0].maxTier) continue;
      assert.deepEqual(refused.attempted, ['primary'], `${entry.id}/${failure}: the ladder kept walking`);
      assert.equal(refused.servedBy, null, entry.id);
      assert.equal(refused.error, failure, entry.id);
    }
  }
});

test('a served response always names a rung, and nothing else does', () => {
  for (const entry of fixture.cases) {
    const { outcome, servedBy } = run(entry);
    assert.equal(servedBy !== null, outcome === 'served', `${entry.id}: ${outcome} named ${servedBy}`);
  }
});

test('every rung is attempted or skipped at most once, in ladder order', () => {
  for (const entry of fixture.cases) {
    const { attempted, skipped } = run(entry);
    const touched = [...attempted, ...skipped.map((entry_) => entry_.name)];
    assert.equal(new Set(touched).size, touched.length, `${entry.id}: a rung was visited twice`);
    const order = fixture.ladder.map((rung) => rung.name);
    const seen = touched.map((name) => order.indexOf(name)).sort((a, b) => a - b);
    assert.deepEqual(seen, [...new Set(seen)], entry.id);
  }
});

test('opening every breaker escalates without calling anything', () => {
  for (const entry of fixture.cases) {
    const shut = run(entry, { open: fixture.ladder.map((rung) => rung.name) });
    assert.equal(shut.outcome, 'escalate', `${entry.id}: something answered with every breaker open`);
    assert.deepEqual(shut.attempted, [], entry.id);
    assert.equal(shut.error, 'no_capacity', entry.id);
  }
});
