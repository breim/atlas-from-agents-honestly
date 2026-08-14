import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Config, Report, Run, evaluate as Evaluate } from './start.ts';

interface Case {
  id: string;
  runs: Run[];
  result: Report;
}

const fixture = expected<{ chapter: string } & Config & { cases: Case[] }>(import.meta.url);
const { evaluate } = await loadImpl<{ evaluate: typeof Evaluate }>(import.meta.url);

const config: Config = {
  budgets: fixture.budgets,
  baseline: fixture.baseline,
  noiseBandBps: fixture.noiseBandBps,
};
const run = (runs: Run[], overrides: Partial<Config> = {}) => evaluate(runs, { ...config, ...overrides });
const spend = (runs: Run[]) => runs.reduce((sum, entry) => sum + entry.costCents, 0);
const resolved = (runs: Run[]) => runs.filter((entry) => entry.outcome === 'resolved');

const cases: Array<[string, string]> = [
  ['a-healthy-release-passes-all-three-gates', 'right, cheap, and fast enough'],
  ['a-run-that-escalated-is-paid-for-and-bought-nothing', 'per attempt says $0.20; per outcome says $1.00'],
  ['an-expensive-release-that-works-costs-the-same-per-outcome', 'the other half of the table'],
  ['nothing-accepted-means-there-is-no-cost-per-outcome', 'a denominator of zero is not a bargain'],
  ['a-three-day-approval-is-not-latency', 'waiting for a person is the system working'],
  ['a-fast-total-can-still-feel-broken', 'time to first token is not a substitute'],
  ['p95-hides-the-tail-that-the-ceiling-catches', 'the incident lives past the percentile'],
  ['a-cost-regression-fails-on-its-own', 'quality alone would have shipped it'],
  ['quality-at-the-bottom-of-the-noise-band-still-passes', 'noise is not a regression'],
  ['quality-one-step-below-the-band-fails', 'and a regression is not noise'],
  ['a-release-with-no-runs-has-nothing-to-gate', 'nothing measured, nothing earned'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(run(entry.runs), entry.result);
  });
}

test('every cent is in the numerator, and only accepted outcomes in the denominator', () => {
  for (const entry of fixture.cases) {
    const { costPerOutcomeCents } = run(entry.runs);
    const accepted = resolved(entry.runs).length;
    const expectedCost = accepted === 0 ? null : Math.floor(spend(entry.runs) / accepted + 0.5);
    assert.equal(costPerOutcomeCents, expectedCost, `${entry.id}: the fraction is wrong`);
  }
});

test('a failed run raises cost per outcome and never lowers it', () => {
  for (const entry of fixture.cases) {
    const before = run(entry.runs).costPerOutcomeCents;
    if (before === null) continue;
    const failed: Run = { outcome: 'escalated', costCents: 50, ttftMs: 400, totalMs: 5000, humanWaitMs: 0 };
    const after = run([...entry.runs, failed]).costPerOutcomeCents!;
    assert.ok(after >= before, `${entry.id}: an escalation made the release look cheaper`);
  }
});

test('cost per attempt never exceeds cost per outcome', () => {
  for (const entry of fixture.cases) {
    const { costPerAttemptCents, costPerOutcomeCents } = run(entry.runs);
    if (costPerAttemptCents === null || costPerOutcomeCents === null) continue;
    assert.ok(costPerAttemptCents <= costPerOutcomeCents, `${entry.id}: the flattering meter was not flattering`);
  }
});

test('human wait is never counted as latency', () => {
  for (const entry of fixture.cases) {
    const stalled = entry.runs.map((entry_) => ({
      ...entry_,
      totalMs: entry_.totalMs + 86_400_000,
      humanWaitMs: entry_.humanWaitMs + 86_400_000,
    }));
    assert.deepEqual(run(stalled), run(entry.runs), `${entry.id}: a day of waiting changed the score`);
  }
});

test('the percentile is the nearest-rank value of the measured times', () => {
  for (const entry of fixture.cases) {
    const measured = entry.runs.map((entry_) => entry_.totalMs - entry_.humanWaitMs).sort((a, b) => a - b);
    const rank = measured.length === 0 ? null : measured[Math.ceil((95 * measured.length) / 100) - 1];
    assert.equal(run(entry.runs).totalP95Ms, rank, `${entry.id}: the percentile does not match the data`);
  }
});

test('a release passes only when all three gates do', () => {
  for (const entry of fixture.cases) {
    const { gates } = run(entry.runs);
    assert.equal(gates.pass, gates.quality && gates.cost && gates.latency, `${entry.id}: a gate was skipped`);
  }
});

test('a run over the hard ceiling always shows in the ceiling share', () => {
  for (const entry of fixture.cases) {
    const over = entry.runs.filter((entry_) => entry_.totalMs - entry_.humanWaitMs > fixture.budgets.hardCeilingMs);
    const share = entry.runs.length === 0 ? 0 : Math.floor((over.length * 10000) / entry.runs.length + 0.5);
    assert.equal(run(entry.runs).overCeilingBps, share, `${entry.id}: the tail was not counted`);
  }
});

test('a stricter noise band never turns a quality failure into a pass', () => {
  for (const entry of fixture.cases) {
    const before = run(entry.runs).gates.quality;
    const after = run(entry.runs, { noiseBandBps: 0 }).gates.quality;
    assert.ok(!after || before, `${entry.id}: tightening the band forgave a regression`);
  }
});

test('spending more per run never improves the cost gate', () => {
  for (const entry of fixture.cases) {
    const before = run(entry.runs).gates.cost;
    const pricier = entry.runs.map((entry_) => ({ ...entry_, costCents: entry_.costCents * 3 }));
    assert.ok(!run(pricier).gates.cost || before, `${entry.id}: tripling the bill helped`);
  }
});
