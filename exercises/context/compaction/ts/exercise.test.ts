import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Compaction, Turn, compact as Compact } from './start.ts';

interface Case {
  id: string;
  turns: Turn[];
  result: Compaction;
}

const fixture = expected<{
  chapter: string;
  budget: number;
  costPerFact: number;
  cases: Case[];
}>(import.meta.url);
const { compact } = await loadImpl<{ compact: typeof Compact }>(import.meta.url);

const run = (entry: Case) => compact(entry.turns, fixture.budget, fixture.costPerFact);

const cases: Array<[string, string]> = [
  ['everything-fits-uncompacted', 'a short transcript is left alone'],
  ['the-oldest-turn-is-summarised-first', 'compaction eats from the old end'],
  ['the-summary-cost-counts-against-the-budget', 'the summary is not free'],
  ['dropping-a-fact-heavy-turn-can-cost-more-than-keeping-it', 'freeing tokens is not monotone'],
  ['a-fact-repeated-across-turns-is-summarised-once', 'the summary deduplicates'],
  ['nothing-fits-even-fully-compacted', 'a transcript can be unfixable'],
  ['an-empty-transcript-fits-trivially', 'nothing to compact is a fit'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('no fact from a dropped turn is ever lost', () => {
  for (const entry of fixture.cases) {
    const { kept, summarised } = run(entry);
    for (const turn of entry.turns) {
      if (kept.includes(turn.id)) continue;
      for (const fact of turn.facts) {
        assert.ok(summarised.includes(fact), `${entry.id}: lost ${fact} with turn ${turn.id}`);
      }
    }
  }
});

test('the kept turns are always the newest ones', () => {
  for (const entry of fixture.cases) {
    const { kept } = run(entry);
    assert.deepEqual(
      kept,
      entry.turns.slice(entry.turns.length - kept.length).map((turn) => turn.id),
      `${entry.id}: kept turns are not a suffix of the transcript`,
    );
  }
});

test('tokens is kept turns plus summary cost', () => {
  for (const entry of fixture.cases) {
    const { kept, summarised, tokens } = run(entry);
    const keptTokens = entry.turns
      .filter((turn) => kept.includes(turn.id))
      .reduce((sum, turn) => sum + turn.tokens, 0);
    assert.equal(
      tokens,
      keptTokens + summarised.length * fixture.costPerFact,
      `${entry.id}: the accounting does not add up`,
    );
  }
});

test('fits is true exactly when the result is within budget', () => {
  for (const entry of fixture.cases) {
    const { tokens, fits } = run(entry);
    assert.equal(fits, tokens <= fixture.budget, `${entry.id}: fits disagrees with the total`);
  }
});

test('a summarised fact never appears twice', () => {
  for (const entry of fixture.cases) {
    const { summarised } = run(entry);
    assert.equal(new Set(summarised).size, summarised.length, `${entry.id}: duplicate fact`);
  }
});
