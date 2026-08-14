import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Rule, route as Route } from './start.ts';

interface Case {
  id: string;
  signals: string[];
  route: string;
}

const fixture = expected<{ chapter: string; table: Rule[]; fallback: string; cases: Case[] }>(
  import.meta.url,
);
const { route } = await loadImpl<{ route: typeof Route }>(import.meta.url);

const run = (entry: Case) => route(entry.signals, fixture.table, fixture.fallback);

const cases: Array<[string, string]> = [
  ['an-aggregation-goes-to-sql', 'counting is a database question'],
  ['a-relationship-question-goes-to-the-graph', 'hops are a graph question'],
  ['an-exact-identifier-goes-to-lexical-search', 'an id is a lexical question'],
  ['a-question-about-right-now-goes-to-the-live-api', 'current state is not in any index'],
  ['no-recognised-signal-falls-back-to-semantic', 'the default is the least bad answer'],
  ['an-unrecognised-signal-also-falls-back', 'an unknown signal is not a route'],
  ['freshness-outranks-aggregation', 'a snapshot cannot answer a freshness question'],
  ['table-order-decides-not-signal-order', 'detection order must not change the route'],
  ['every-signal-at-once-still-routes-to-one-store', 'the router picks one store, always'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.equal(run(entry), entry.route);
  });
}

test('the route is always a declared store or the fallback', () => {
  const stores = new Set([...fixture.table.map((rule) => rule.store), fixture.fallback]);
  for (const entry of fixture.cases) {
    assert.ok(stores.has(run(entry)), `${entry.id}: routed somewhere undeclared`);
  }
});

test('signal order never changes the route', () => {
  for (const entry of fixture.cases) {
    assert.equal(
      route([...entry.signals].reverse(), fixture.table, fixture.fallback),
      run(entry),
      `${entry.id}: the route depends on detection order`,
    );
  }
});

test('the winning rule is the highest matching one in the table', () => {
  for (const entry of fixture.cases) {
    const chosen = run(entry);
    if (chosen === fixture.fallback && !fixture.table.some((r) => r.store === chosen)) continue;
    const index = fixture.table.findIndex((rule) => rule.store === chosen);
    for (const earlier of fixture.table.slice(0, index)) {
      assert.ok(
        !entry.signals.includes(earlier.signal),
        `${entry.id}: skipped ${earlier.store}, which also matched`,
      );
    }
  }
});

test('adding the top signal always wins', () => {
  const top = fixture.table[0];
  for (const entry of fixture.cases) {
    assert.equal(
      route([...entry.signals, top.signal], fixture.table, fixture.fallback),
      top.store,
      `${entry.id}: the highest-precedence signal did not win`,
    );
  }
});
