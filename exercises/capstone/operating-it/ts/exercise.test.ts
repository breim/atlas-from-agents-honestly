import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Drift, Incident, Ledger, Policy, Report, Rollout, Signal, operate as OperateFn } from './start.ts';

interface Case {
  id: string; rollout: Rollout; signals: Signal[]; incident: Incident;
  drift: Drift; ledger: Ledger; policy: Policy; result: Report;
}
interface Fixture { chapter: string; policy: Policy; cases: Case[] }

const fixture = expected<Fixture>(import.meta.url);
const { operate } = await loadImpl<{ operate: typeof OperateFn }>(import.meta.url);
const go = (
  entry: Case,
  rollout = entry.rollout,
  signals = entry.signals,
  incident = entry.incident,
  drift = entry.drift,
  ledger = entry.ledger,
) => operate(rollout, signals, incident, drift, ledger, entry.policy);

const cases: Array<[string, string]> = [
  ['a-good-rollout-is-anticlimactic', 'one number in a manifest'],
  ['a-rollout-touching-several-fields-is-not-reversible-in-seconds', 'reversible in seconds'],
  ['discarding-the-previous-index-removes-the-fast-fix', 'decided months earlier'],
  ['a-canary-read-on-dashboards-finds-nothing', 'forty escalations, read'],
  ['a-canary-too-short-to-read-is-not-a-canary', 'week one is for reading'],
  ['a-metric-that-moved-because-its-definition-was-wrong-is-warned', 'the definition, not the code'],
  ['an-incident-that-skipped-the-fallback-is-not-unremarkable', 'six steps, unremarkable'],
  ['a-drill-with-no-human-consequence-missed-the-queue', 'the queue when gating triples'],
  ['drift-diagnosis-missing-a-query-has-no-time-to-report', 'four queries, nine minutes'],
  ['a-ledger-whose-misses-do-not-add-up-is-not-honest', 'separated by cause'],
  ['a-ledger-that-under-reports-its-misses-is-not-honest', 'including the misses'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(go(entry), entry.result);
  });
}

test('a rollout is reversible only when it is small and the old build survives', () => {
  const entry = findCase<Case>(fixture, 'a-good-rollout-is-anticlimactic');
  for (const fields of [1, 2]) {
    for (const previousIndexRetained of [true, false]) {
      const rollout = {
        ...entry.rollout,
        changedFields: Array.from({ length: fields }, (_, index) => `f${index}`),
        previousIndexRetained,
      };
      const outcome = go(entry, rollout);
      const owed = fields <= entry.policy.maxChangedFields && previousIndexRetained;
      assert.equal(outcome.reversibleInSeconds, owed, `${fields} fields / retained ${previousIndexRetained}`);
      assert.equal(outcome.status === 'operable', owed, `${fields} fields / retained ${previousIndexRetained}`);
    }
  }
});

test('the canary must be long enough and read by a person', () => {
  const entry = findCase<Case>(fixture, 'a-good-rollout-is-anticlimactic');
  const minimum = entry.policy.minCanaryDays;
  for (const canaryDays of [minimum - 1, minimum, minimum + 1]) {
    const outcome = go(entry, { ...entry.rollout, canaryDays });
    assert.equal(outcome.status === 'operable', canaryDays >= minimum, `${canaryDays} days`);
  }
  const dashboards = go(entry, { ...entry.rollout, canaryReviewedBy: 'dashboards' });
  assert.equal(dashboards.status, 'not-operable', 'a dashboard-only canary was accepted');
});

test('a moved definition warns and a moved implementation does not', () => {
  const entry = findCase<Case>(fixture, 'a-good-rollout-is-anticlimactic');
  for (const kind of ['definition', 'implementation'] as const) {
    for (const moved of [true, false]) {
      const outcome = go(entry, entry.rollout, [{ name: 'probe', kind, moved }]);
      const owed = moved && kind === 'definition';
      assert.equal(outcome.warnings.length > 0, owed, `${kind} moved ${moved}`);
      assert.equal(outcome.status, 'operable', 'a signal warning failed the report');
    }
  }
});

test('every incident step is required on its own', () => {
  const entry = findCase<Case>(fixture, 'a-good-rollout-is-anticlimactic');
  for (const step of entry.policy.incidentSteps) {
    const incident = { ...entry.incident, [step]: false };
    const outcome = go(entry, entry.rollout, entry.signals, incident);
    assert.equal(outcome.status, 'not-operable', `skipping ${step} was accepted`);
    assert.ok(outcome.errors.some((error) => error.includes(step)), `${step} unnamed`);
  }
});

test('the human consequence is a step of its own', () => {
  const entry = findCase<Case>(fixture, 'a-good-rollout-is-anticlimactic');
  const outcome = go(entry, entry.rollout, entry.signals, { ...entry.incident, humanConsequenceInjected: false });
  assert.equal(outcome.status, 'not-operable', 'a technical-only drill passed');
  assert.ok(outcome.errors.some((error) => error.includes('human consequence')), 'it was refused without saying why');
});

test('drift is diagnosable only when all four queries are instrumented', () => {
  const entry = findCase<Case>(fixture, 'a-good-rollout-is-anticlimactic');
  const all = entry.policy.driftQueries;
  for (const query of all) {
    const outcome = go(entry, entry.rollout, entry.signals, entry.incident, {
      queriesRun: all.filter((item) => item !== query),
    });
    assert.equal(outcome.driftMinutes, null, `dropping ${query} still claimed a diagnosis time`);
    assert.equal(outcome.status, 'not-operable', `dropping ${query} was accepted`);
  }
  const complete = go(entry);
  assert.ok((complete.driftMinutes as number) > 0, 'a complete set reported no time');
});

test('the ledger adds up in both directions or it is not honest', () => {
  const entry = findCase<Case>(fixture, 'a-good-rollout-is-anticlimactic');
  const base = entry.ledger;
  const misses = base.claimed - base.hit;
  const probes: Array<[string, Ledger]> = [
    ['honest', base],
    ['under-reported', { ...base, missesReported: misses - 1 }],
    ['miscategorised', { ...base, structuralMisses: base.structuralMisses + 1 }],
    ['over-reported', { ...base, missesReported: misses + 1 }],
  ];
  for (const [name, ledger] of probes) {
    const outcome = go(entry, entry.rollout, entry.signals, entry.incident, entry.drift, ledger);
    assert.equal(outcome.ledgerHonest, name === 'honest', `${name} ledger`);
    assert.equal(outcome.status === 'operable', name === 'honest', `${name} ledger status`);
  }
});

test('a known-cause miss and a structural miss are counted separately', () => {
  const entry = findCase<Case>(fixture, 'a-good-rollout-is-anticlimactic');
  assert.ok(entry.ledger.structuralMisses > 0, 'the fixture reports no structural miss');
  assert.ok(entry.ledger.knownCauseMisses > 0, 'the fixture reports no known-cause miss');
  assert.equal(
    entry.ledger.structuralMisses + entry.ledger.knownCauseMisses,
    entry.ledger.claimed - entry.ledger.hit,
    'the fixture ledger does not add up',
  );
  assert.equal(go(entry).ledgerHonest, true);
});

test('a report that is not operable says every reason', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    assert.equal(outcome.status === 'not-operable', outcome.errors.length > 0, `${entry.id}: status vs errors`);
  }
});
