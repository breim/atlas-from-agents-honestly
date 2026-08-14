import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Budget, Executed, Plan, Prices, run as Run } from './start.ts';

interface Case {
  id: string;
  plan?: Plan;
  budget: Budget;
  result: Executed;
}

interface Fixture {
  chapter: string;
  prices: Prices;
  plan: Plan;
  cases: Case[];
}

const fixture = expected<Fixture>(import.meta.url);
const { run } = await loadImpl<{ run: typeof Run }>(import.meta.url);

const planOf = (entry: Case) => entry.plan ?? fixture.plan;
const execute = (entry: Case, plan = planOf(entry), budget = entry.budget) => run(plan, budget, fixture.prices);
const generous: Budget = { capMicros: 10 ** 12, softRatioBps: 10000 };

const cases: Array<[string, string]> = [
  ['a-four-turn-run-spends-most-of-it-re-reading-itself', 'input volume is what multiplies'],
  ['doubling-the-turns-more-than-doubles-the-bill', 'the quadratic, measured'],
  ['compaction-caps-what-is-re-sent', 'a context decision that is a cost decision'],
  ['the-soft-ratio-degrades-before-it-fails', 'degrading bought a fifth turn'],
  ['without-degradation-the-run-stops-a-turn-sooner', 'the same budget, less work'],
  ['a-cap-below-the-first-turn-stops-before-spending-anything', 'a refused turn is not billed'],
  ['a-run-with-no-turns-spends-nothing', 'nothing to re-send'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(execute(entry), entry.result);
  });
}

test('the accounting adds up, both ways', () => {
  for (const entry of fixture.cases) {
    const { turns, spentMicros, inputMicros, outputMicros } = execute(entry);
    assert.equal(inputMicros + outputMicros, spentMicros, `${entry.id}: the split does not sum`);
    assert.equal(turns.reduce((sum, turn) => sum + turn.costMicros, 0), spentMicros, `${entry.id}: turns`);
  }
});

test('a run never spends past its cap', () => {
  for (const entry of fixture.cases) {
    assert.ok(execute(entry).spentMicros <= entry.budget.capMicros, `${entry.id}: the cap did not bind`);
  }
});

test('a refused turn is not recorded and not billed', () => {
  for (const entry of fixture.cases) {
    const { turns, outcome } = execute(entry);
    assert.ok(turns.length <= planOf(entry).maxTurns, entry.id);
    assert.equal(outcome === 'completed', turns.length === planOf(entry).maxTurns, `${entry.id}: ${outcome}`);
  }
});

test('the context grows every turn until compaction caps it', () => {
  for (const entry of fixture.cases) {
    const plan = planOf(entry);
    const { turns } = execute(entry);
    turns.forEach((turn, index) => {
      const grown = plan.systemTokens + plan.toolsTokens + index * plan.perTurnTokens;
      const owed = plan.compactionCap > 0 ? Math.min(grown, plan.compactionCap) : grown;
      assert.equal(turn.contextTokens, owed, `${entry.id}: turn ${turn.index}`);
      if (plan.compactionCap > 0) assert.ok(turn.contextTokens <= plan.compactionCap, entry.id);
    });
  }
});

test('input dominates whenever the context outweighs the reply', () => {
  for (const entry of fixture.cases) {
    const plan = planOf(entry);
    const { inputMicros, outputMicros, turns } = execute(entry);
    if (turns.length === 0) continue;
    const contextHeavy = plan.systemTokens + plan.toolsTokens > plan.outputTokens * 5;
    if (contextHeavy) assert.ok(inputMicros > outputMicros, `${entry.id}: output outweighed the transcript`);
  }
});

test('doubling the turns more than doubles the input, without compaction', () => {
  for (const entry of fixture.cases) {
    const plan = planOf(entry);
    if (plan.compactionCap > 0 || plan.perTurnTokens === 0 || plan.maxTurns === 0) continue;
    const half = execute(entry, { ...plan, maxTurns: plan.maxTurns }, generous).inputMicros;
    const full = execute(entry, { ...plan, maxTurns: plan.maxTurns * 2 }, generous).inputMicros;
    assert.ok(full > half * 2, `${entry.id}: ${full} is not superlinear against ${half}`);
  }
});

test('compaction never costs more for the same number of turns', () => {
  for (const entry of fixture.cases) {
    const plan = planOf(entry);
    if (plan.maxTurns === 0) continue;
    const uncapped = execute(entry, { ...plan, compactionCap: 0 }, generous).spentMicros;
    const capped = execute(entry, { ...plan, compactionCap: plan.systemTokens }, generous).spentMicros;
    assert.ok(capped <= uncapped, `${entry.id}: capping the context raised the bill`);
  }
});

test('degrading earlier never buys fewer turns', () => {
  for (const entry of fixture.cases) {
    const eager = execute(entry, planOf(entry), { ...entry.budget, softRatioBps: 0 });
    const never = execute(entry, planOf(entry), { ...entry.budget, softRatioBps: 10000 });
    assert.ok(eager.turns.length >= never.turns.length, `${entry.id}: degrading cost work`);
  }
});

test('a bigger cap never buys fewer turns', () => {
  for (const entry of fixture.cases) {
    const before = execute(entry).turns.length;
    const richer = execute(entry, planOf(entry), { ...entry.budget, capMicros: entry.budget.capMicros * 10 });
    assert.ok(richer.turns.length >= before, `${entry.id}: more money did less`);
  }
});
