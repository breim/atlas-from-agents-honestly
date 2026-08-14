import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Allocation, Budget, Request, allocate as Allocate } from './start.ts';

interface Case {
  id: string;
  budget?: Budget;
  request: Request;
  result: Allocation;
}

interface Fixture {
  chapter: string;
  budget: Budget;
  cases: Case[];
}

const fixture = expected<Fixture>(import.meta.url);
const { allocate } = await loadImpl<{ allocate: typeof Allocate }>(import.meta.url);

const budgetOf = (entry: Case) => entry.budget ?? fixture.budget;
const go = (entry: Case, budget = budgetOf(entry), request = entry.request) => allocate(request, budget);

const cases: Array<[string, string]> = [
  ['everything-fits-and-most-of-the-window-stays-empty', 'headroom is the plan, not a gap in it'],
  ['a-larger-window-changes-only-the-headroom', 'permission to send more is not a reason to'],
  ['too-many-documents-are-reranked-down-not-given-more-room', 'never just add room'],
  ['the-oldest-tool-results-go-first', 'facts that already did their work'],
  ['history-is-compacted-oldest-first', 'the late-run regime'],
  ['facts-are-evicted-before-turns-and-turns-before-documents', 'the order, decided in advance'],
  ['a-system-prompt-over-budget-fails-the-build-and-evicts-nothing', 'fix the constant'],
  ['too-many-tools-fails-the-build-before-anything-runs', 'over budget means too many tools'],
  ['the-output-reserve-is-never-lent-out', 'a hard reserve'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(go(entry), entry.result);
  });
}

test('no claimant is ever over its allocation once the build succeeds', () => {
  for (const entry of fixture.cases) {
    const budget = budgetOf(entry);
    const outcome = go(entry);
    if (outcome.status === 'failed-build') continue;
    for (const row of budget.rows) {
      const spent = outcome.breakdown[row.claimant as keyof Allocation['breakdown']];
      assert.ok(spent <= row.allocation, `${entry.id}: ${row.claimant} spent ${spent} of ${row.allocation}`);
    }
  }
});

test('the output reserve is never lent out to a claimant', () => {
  for (const entry of fixture.cases) {
    const budget = budgetOf(entry);
    const outcome = go(entry);
    assert.equal(outcome.headroom, budget.window - budget.reserveOutput - outcome.total, entry.id);
    assert.ok(outcome.total + budget.reserveOutput + outcome.headroom === budget.window, `${entry.id}: reserve moved`);
  }
});

test('a larger window changes the headroom and nothing else', () => {
  for (const entry of fixture.cases) {
    const budget = budgetOf(entry);
    const roomier = { ...budget, window: budget.window * 10 };
    const before = go(entry);
    const after = go(entry, roomier);
    assert.deepEqual(after.breakdown, before.breakdown, `${entry.id}: a bigger window changed the allocation`);
    assert.deepEqual(after.evicted, before.evicted, `${entry.id}: a bigger window saved a claimant`);
    assert.equal(after.total, before.total, entry.id);
    assert.ok(after.headroom > before.headroom, entry.id);
  }
});

test('a failed build evicts nothing, whatever else is over', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    if (outcome.status !== 'failed-build') continue;
    assert.deepEqual(outcome.evicted, [], `${entry.id}: a runtime policy ran for a constant`);
    assert.ok(outcome.errors.length > 0, entry.id);
    const untouched = {
      system: entry.request.system,
      schemas: entry.request.schemas,
      documents: entry.request.documents.reduce((running, item) => running + item.tokens, 0),
      results: entry.request.results.reduce((running, item) => running + item.tokens, 0),
      history: entry.request.history.reduce((running, item) => running + item.tokens, 0),
      user: entry.request.user,
    };
    assert.deepEqual(outcome.breakdown, untouched, `${entry.id}: a claimant was trimmed anyway`);
  }
});

test('a constant over its allocation is the only thing that fails a build', () => {
  for (const entry of fixture.cases) {
    const budget = budgetOf(entry);
    const outcome = go(entry);
    const over = ['system', 'schemas'].filter(
      (claimant) =>
        entry.request[claimant as 'system' | 'schemas'] >
        (budget.rows.find((row) => row.claimant === claimant) as { allocation: number }).allocation,
    );
    assert.equal(outcome.status === 'failed-build', over.length > 0, entry.id);
    assert.equal(outcome.errors.length, over.length, entry.id);
  }
});

test('the system prompt and the tool schemas are never evicted', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    for (const eviction of outcome.evicted) {
      assert.ok(!['system', 'schemas'].includes(eviction.claimant), `${entry.id}: evicted ${eviction.claimant}`);
    }
    if (outcome.status !== 'failed-build') {
      assert.equal(outcome.breakdown.system, entry.request.system, entry.id);
      assert.equal(outcome.breakdown.schemas, entry.request.schemas, entry.id);
    }
  }
});

test('evictions follow the declared order, not the size of the claimant', () => {
  for (const entry of fixture.cases) {
    const order = budgetOf(entry).evictionOrder;
    const seen = go(entry).evicted.map((eviction) => order.indexOf(eviction.claimant));
    for (const position of seen) assert.ok(position >= 0, `${entry.id}: evicted an unlisted claimant`);
    assert.deepEqual([...seen].sort((a, b) => a - b), seen, `${entry.id}: eviction order was not honoured`);
  }
});

test('within a claimant, the oldest and the lowest-ranked go first', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    const gone = (claimant: string) => outcome.evicted.filter((e) => e.claimant === claimant).map((e) => e.id);

    const droppedResults = gone('results');
    const keptResults = entry.request.results.filter((item) => !droppedResults.includes(item.id));
    for (const dropped of entry.request.results.filter((item) => droppedResults.includes(item.id))) {
      for (const kept of keptResults) {
        assert.ok(dropped.step < kept.step, `${entry.id}: dropped result ${dropped.id} was not older`);
      }
    }

    const droppedDocs = gone('documents');
    const keptDocs = entry.request.documents.filter((item) => !droppedDocs.includes(item.id));
    for (const dropped of entry.request.documents.filter((item) => droppedDocs.includes(item.id))) {
      for (const kept of keptDocs) {
        assert.ok(dropped.rank > kept.rank, `${entry.id}: dropped document ${dropped.id} outranked a kept one`);
      }
    }
  }
});

test('the total is the breakdown, and eviction only ever removes tokens', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    const counted = Object.values(outcome.breakdown).reduce((running, value) => running + value, 0);
    assert.equal(outcome.total, counted, `${entry.id}: the total disagrees with its own rows`);
    const removed = outcome.evicted.reduce((running, eviction) => running + eviction.tokens, 0);
    const raw =
      entry.request.system +
      entry.request.schemas +
      entry.request.user +
      [...entry.request.documents, ...entry.request.results, ...entry.request.history].reduce(
        (running, item) => running + item.tokens,
        0,
      );
    assert.equal(outcome.total, raw - removed, `${entry.id}: tokens appeared or vanished`);
  }
});

test('an unbounded claimant cannot grow the request past its row', () => {
  const entry = findCase<Case>(fixture, 'everything-fits-and-most-of-the-window-stays-empty');
  const flooded = {
    ...entry.request,
    results: [{ id: 'res-flood', step: 9, tokens: 400_000 }],
    history: entry.request.history.map((turn) => ({ ...turn, tokens: 250_000 })),
  };
  const outcome = go(entry, budgetOf(entry), flooded);
  assert.ok(outcome.breakdown.results <= 8000, 'a forty-thousand-row result was not bounded at entry');
  assert.ok(outcome.breakdown.history <= 30_000, 'history was not bounded at entry');
  assert.equal(outcome.status, 'trimmed');
});
