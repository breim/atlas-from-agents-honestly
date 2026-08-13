import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Run, Turn, run as RunFn } from './start.ts';

interface Case {
  id: string;
  turns: Turn[];
  result: Run;
}

const fixture = expected<{ chapter: string; corpus: Record<string, string>; cases: Case[] }>(
  import.meta.url,
);
const { run } = await loadImpl<{ run: typeof RunFn }>(import.meta.url);

const cases: Array<[string, string]> = [
  ['a-statement-never-touches-the-corpus', 'a turn that asks nothing retrieves nothing'],
  ['one-request-one-fetch', 'a request reaches the index exactly once'],
  ['a-repeated-request-fetches-once', 'the second identical request is served from cache'],
  ['distinct-requests-each-fetch', 'different queries each cost a fetch'],
  ['a-miss-is-still-a-fetch-and-is-still-cached', 'a miss is cached as a miss, not retried'],
  ['statements-between-requests-do-not-refetch', 'a statement does not evict the cache'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry.turns, fixture.corpus), entry.result);
  });
}

test('one result per turn, always', () => {
  for (const entry of fixture.cases) {
    assert.equal(
      run(entry.turns, fixture.corpus).results.length,
      entry.turns.length,
      `${entry.id}: results and turns disagree`,
    );
  }
});

test('fetches never repeat a query', () => {
  for (const entry of fixture.cases) {
    const { fetches } = run(entry.turns, fixture.corpus);
    assert.equal(new Set(fetches).size, fetches.length, `${entry.id}: ${fetches.join(', ')}`);
  }
});

test('nothing is fetched that was never asked for', () => {
  for (const entry of fixture.cases) {
    const asked = new Set(entry.turns.filter((t): t is { ask: string } => 'ask' in t).map((t) => t.ask));
    for (const query of run(entry.turns, fixture.corpus).fetches) {
      assert.ok(asked.has(query), `${entry.id}: fetched ${query} unprompted`);
    }
  }
});
