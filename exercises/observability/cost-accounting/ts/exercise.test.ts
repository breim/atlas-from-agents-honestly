import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Call, Invoice, Ledger, Prices, account as Account } from './start.ts';

interface Case {
  id: string;
  invoice: Invoice;
  calls: Call[];
  result: Ledger;
}

const fixture = expected<{ chapter: string; prices: Prices; cases: Case[] }>(import.meta.url);
const { account } = await loadImpl<{ account: typeof Account }>(import.meta.url);

const run = (entry: Case, prices = fixture.prices) => account(entry.calls, prices, entry.invoice);
const priceOf = (call: Call, prices: Prices) => {
  const rates = prices[call.priceVersion][call.model];
  return call.inputTokens * rates.input + call.cachedInputTokens * rates.cachedInput + call.outputTokens * rates.output;
};

const cases: Array<[string, string]> = [
  ['a-call-is-priced-from-the-table-it-recorded', 'the meter is built at the gateway'],
  ['cached-input-is-a-different-meter', 'the same thousand tokens, a third of the price'],
  ['a-retry-costs-full-price', 'a reliability problem on the cost dashboard'],
  ['eval-traffic-is-its-own-bucket', 'a colleague running the suite twice'],
  ['the-mean-would-have-said-nothing-was-wrong', 'p50 and p90 are fine; one run took 89%'],
  ['a-repriced-table-does-not-move-an-old-call', 'same tokens, different recorded price'],
  ['a-gap-means-traffic-that-never-reached-the-gateway', 'an unmetered path is a control blind spot'],
  ['a-two-percent-gap-still-reconciles', 'reconciliation is a tolerance'],
  ['no-calls-reconcile-with-no-invoice', 'nothing spent, nothing owed'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('the three buckets account for every micro', () => {
  for (const entry of fixture.cases) {
    const { total, productive, unproductive, synthetic } = run(entry).totals;
    assert.equal(productive + unproductive + synthetic, total, `${entry.id}: spend went missing`);
  }
});

test('every call is priced by the table version it recorded', () => {
  for (const entry of fixture.cases) {
    const { priced } = run(entry);
    entry.calls.forEach((call, index) => {
      assert.deepEqual(priced[index], { id: call.id, costMicros: priceOf(call, fixture.prices) }, entry.id);
    });
  }
});

test('adding a new price version never moves a recorded cost', () => {
  for (const entry of fixture.cases) {
    const inflated: Prices = {
      ...fixture.prices,
      '2027-01': { 'atlas-1': { input: 9000, cachedInput: 900, output: 45000 }, 'atlas-mini': { input: 1, cachedInput: 1, output: 1 } },
    };
    assert.deepEqual(run(entry, inflated), run(entry), `${entry.id}: last quarter's dashboard moved`);
  }
});

test('moving a token from input to cache never costs more', () => {
  for (const entry of fixture.cases) {
    const warmed = entry.calls.map((call) => ({
      ...call,
      inputTokens: 0,
      cachedInputTokens: call.cachedInputTokens + call.inputTokens,
    }));
    const before = run(entry).totals.total;
    const after = account(warmed, fixture.prices, entry.invoice).totals.total;
    assert.ok(after <= before, `${entry.id}: a cache hit made the call more expensive`);
  }
});

test('the cache hit rate ignores synthetic traffic', () => {
  for (const entry of fixture.cases) {
    const real = entry.calls.filter((call) => !call.synthetic);
    const cached = real.reduce((sum, call) => sum + call.cachedInputTokens, 0);
    const uncached = real.reduce((sum, call) => sum + call.inputTokens, 0);
    const share = cached + uncached === 0 ? 0 : Math.floor((cached * 10000) / (cached + uncached) + 0.5);
    assert.equal(run(entry).cacheHitBps, share, `${entry.id}: eval traffic moved the cache rate`);
  }
});

test('the percentiles never go backwards', () => {
  for (const entry of fixture.cases) {
    const { p50, p90, p99, max } = run(entry).runCostMicros;
    if (p50 === null) {
      assert.deepEqual([p90, p99, max], [null, null, null], entry.id);
      continue;
    }
    assert.ok(p50 <= p90! && p90! <= p99! && p99! <= max!, `${entry.id}: ${p50} ${p90} ${p99} ${max}`);
  }
});

test('the distribution is over runs, so two calls in one run are one number', () => {
  for (const entry of fixture.cases) {
    const real = entry.calls.filter((call) => !call.synthetic);
    const spend = real.reduce((sum, call) => sum + priceOf(call, fixture.prices), 0);
    const { max } = run(entry).runCostMicros;
    if (max === null) continue;
    assert.ok(max <= spend, `${entry.id}: a run cost more than everything`);
    const runs = new Set(real.map((call) => call.runId));
    if (runs.size === 1) assert.equal(max, spend, `${entry.id}: one run should hold all of it`);
  }
});

test('synthetic runs never enter the distribution', () => {
  for (const entry of fixture.cases) {
    const withoutEvals = entry.calls.filter((call) => !call.synthetic);
    const stripped = account(withoutEvals, fixture.prices, entry.invoice);
    const full = run(entry);
    assert.deepEqual(stripped.runCostMicros, full.runCostMicros, `${entry.id}: an eval run was ranked`);
    assert.equal(stripped.topRunsShareBps, full.topRunsShareBps, entry.id);
  }
});

test('reconciliation is exactly the gap against the tolerance', () => {
  for (const entry of fixture.cases) {
    const { reconciliation } = run(entry);
    assert.equal(reconciliation.recordedMicros, run(entry).totals.total, entry.id);
    assert.equal(reconciliation.reconciles, reconciliation.gapBps <= entry.invoice.toleranceBps, entry.id);
  }
});
