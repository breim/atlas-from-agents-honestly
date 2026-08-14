import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Policy, Report, Suite, harden as HardenFn } from './start.ts';

interface Case { id: string; suite: Suite; policy: Policy; result: Report }
interface Fixture { chapter: string; policy: Policy; cases: Case[] }

const fixture = expected<Fixture>(import.meta.url);
const { harden } = await loadImpl<{ harden: typeof HardenFn }>(import.meta.url);
const go = (entry: Case, suite = entry.suite) => harden(suite, entry.policy);

const cases: Array<[string, string]> = [
  ['invariants-gate-and-rates-report', 'no threshold, no re-runs'],
  ['a-dataset-with-no-negatives-throws-away-its-only-deterministic-assertions', 'take every one'],
  ['a-dataset-that-never-promotes-a-failure-has-stopped-learning', 'growth at the rate it breaks'],
  ['a-rate-gated-as-if-it-were-an-invariant-is-refused', 're-run until it passes'],
  ['an-invariant-carrying-a-threshold-is-refused', 'an invariant has no threshold'],
  ['three-gated-rates-blow-the-flake-budget', 'false alarms by construction'],
  ['a-trace-missing-one-of-the-four-fields-is-soft', 'demanded by three chapters each'],
  ['a-suite-with-no-approval-fast-forward-injection-is-soft', 'found by a customer otherwise'],
  ['a-security-review-against-the-design-is-not-a-review', 'against the built system'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(go(entry), entry.result);
  });
}

test('every dataset source is required, one at a time', () => {
  const entry = findCase<Case>(fixture, 'invariants-gate-and-rates-report');
  for (const source of entry.policy.requiredSources) {
    const dataset = { ...entry.suite.dataset, [source]: 0 };
    const outcome = go(entry, { ...entry.suite, dataset });
    assert.equal(outcome.status, 'soft', `a dataset with no ${source} was called hardened`);
    assert.ok(outcome.errors.some((error) => error.includes(source)), `${source} unnamed`);
  }
});

test('an invariant gates and a rate never does', () => {
  const entry = findCase<Case>(fixture, 'invariants-gate-and-rates-report');
  for (const kind of ['invariant', 'rate'] as const) {
    const criteria = [{ name: 'probe', kind, gated: true, threshold: null }];
    const outcome = go(entry, { ...entry.suite, criteria });
    assert.equal(outcome.status === 'hardened', kind === 'invariant', `a gated ${kind}`);
    assert.deepEqual(outcome.gated, kind === 'invariant' ? ['probe'] : [], `${kind}: gated list`);
  }
});

test('an invariant carrying a threshold is a category error', () => {
  const entry = findCase<Case>(fixture, 'invariants-gate-and-rates-report');
  for (const threshold of [null, 0, 9900]) {
    const criteria = [{ name: 'probe', kind: 'invariant' as const, gated: true, threshold }];
    const outcome = go(entry, { ...entry.suite, criteria });
    assert.equal(outcome.status === 'hardened', threshold === null, `threshold ${threshold}`);
  }
});

test('the flake budget is spent only by gated rates', () => {
  const entry = findCase<Case>(fixture, 'invariants-gate-and-rates-report');
  const rate = entry.policy.rateFalseAlarmBps;
  for (const count of [0, 1, 2, 3]) {
    const criteria = [
      ...entry.suite.criteria.filter((item) => item.kind === 'invariant'),
      ...Array.from({ length: count }, (_, index) => ({
        name: `r${index}`,
        kind: 'rate' as const,
        gated: true,
        threshold: 5000,
      })),
    ];
    const outcome = go(entry, { ...entry.suite, criteria });
    assert.equal(outcome.flakeSpendBps, count * rate, `${count} gated rates`);
  }
  const invariantsOnly = go(entry, {
    ...entry.suite,
    criteria: entry.suite.criteria.filter((item) => item.kind === 'invariant'),
  });
  assert.equal(invariantsOnly.flakeSpendBps, 0, 'invariants spent the flake budget');
});

test('the flake budget is a hard limit, at the boundary', () => {
  const entry = findCase<Case>(fixture, 'invariants-gate-and-rates-report');
  const rate = entry.policy.rateFalseAlarmBps;
  const budget = entry.policy.flakeBudgetBps;
  for (const count of [0, 1, 2, 3, 4]) {
    const criteria = Array.from({ length: count }, (_, index) => ({
      name: `r${index}`,
      kind: 'rate' as const,
      gated: true,
      threshold: 5000,
    }));
    const outcome = go(entry, { ...entry.suite, criteria });
    assert.equal(
      outcome.errors.some((error) => error.includes('bps against a budget')),
      count * rate > budget,
      `${count} gated rates against a budget of ${budget}`,
    );
  }
});

test('every criterion is gated or reported, and a refused one is neither', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    const seen = [...outcome.gated, ...outcome.reported];
    assert.equal(new Set(seen).size, seen.length, `${entry.id}: a criterion appeared twice`);
    for (const criterion of entry.suite.criteria) {
      if (seen.includes(criterion.name)) continue;
      assert.ok(
        outcome.errors.some((error) => error.startsWith(criterion.name)),
        `${entry.id}: ${criterion.name} vanished without a reason`,
      );
    }
  }
});

test('every required trace field is required on its own', () => {
  const entry = findCase<Case>(fixture, 'invariants-gate-and-rates-report');
  for (const field of entry.policy.requiredTraceFields) {
    const traceFields = entry.suite.traceFields.filter((item) => item !== field);
    const outcome = go(entry, { ...entry.suite, traceFields });
    assert.equal(outcome.status, 'soft', `a trace with no ${field} was called hardened`);
    assert.ok(outcome.errors.some((error) => error.includes(field)), `${field} unnamed`);
  }
});

test('every required injection is required on its own', () => {
  const entry = findCase<Case>(fixture, 'invariants-gate-and-rates-report');
  for (const injection of entry.policy.requiredInjections) {
    const injections = entry.suite.injections.filter((item) => item !== injection);
    const outcome = go(entry, { ...entry.suite, injections });
    assert.equal(outcome.status, 'soft', `a suite with no ${injection} was called hardened`);
    assert.ok(outcome.errors.some((error) => error.includes(injection)), `${injection} unnamed`);
  }
});

test('the dataset size is the sum of its four buckets', () => {
  for (const entry of fixture.cases) {
    const owed = Object.values(entry.suite.dataset).reduce((total, value) => total + value, 0);
    assert.equal(go(entry).datasetSize, owed, `${entry.id}: the dataset size is wrong`);
  }
});

test('the review must run against what was built', () => {
  const entry = findCase<Case>(fixture, 'invariants-gate-and-rates-report');
  for (const reviewedAgainst of ['built-system', 'design'] as const) {
    const outcome = go(entry, { ...entry.suite, reviewedAgainst });
    assert.equal(outcome.status === 'hardened', reviewedAgainst === 'built-system', reviewedAgainst);
  }
});

test('a soft suite names every reason it is soft', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    assert.equal(outcome.status === 'soft', outcome.errors.length > 0, `${entry.id}: status and errors disagree`);
  }
});
