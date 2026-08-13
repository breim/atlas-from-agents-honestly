import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Route, route as RouteFn } from './start.ts';

interface Case {
  id: string;
  cachedAt: number | null;
  maxAge: number;
  route: Route;
}

const fixture = expected<{ chapter: string; now: number; cases: Case[] }>(import.meta.url);
const { route } = await loadImpl<{ route: typeof RouteFn }>(import.meta.url);

const run = (entry: Case) => route(entry.cachedAt, fixture.now, entry.maxAge);

const cases: Array<[string, string]> = [
  ['fresh-goes-to-cache', 'a recent index answers the question'],
  ['stale-goes-live', 'an old index does not'],
  ['exactly-at-the-boundary-goes-live', 'the boundary is exclusive'],
  ['one-millisecond-inside-the-boundary-goes-to-cache', 'one millisecond under is still fresh'],
  ['no-cache-entry-goes-live', 'nothing cached is not accidentally fresh'],
  ['a-max-age-of-zero-always-goes-live', 'a zero window disables the cache'],
  ['a-clock-skewed-future-entry-is-fresh', 'a forward-skewed clock is not infinitely stale'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.equal(run(entry), entry.route);
  });
}

test('the route is always one of the two', () => {
  for (const entry of fixture.cases) {
    assert.ok(['cache', 'live'].includes(run(entry)), `${entry.id}: routed somewhere else`);
  }
});

test('routing is monotone in age', () => {
  for (const entry of fixture.cases) {
    if (entry.cachedAt === null || run(entry) !== 'live') continue;
    assert.equal(
      route(entry.cachedAt - 1, fixture.now, entry.maxAge),
      'live',
      `${entry.id}: an older entry routed to cache while a newer one went live`,
    );
  }
});
