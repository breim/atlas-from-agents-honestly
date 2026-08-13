import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Route, route as RouteFn } from './start.ts';

interface Case {
  id: string;
  request: string;
  route: string;
}

const fixture = expected<{ chapter: string; routes: Route[]; fallback: string; cases: Case[] }>(
  import.meta.url,
);
const { route } = await loadImpl<{ route: typeof RouteFn }>(import.meta.url);

const run = (entry: Case) => route(entry.request, fixture.routes, fixture.fallback);

const cases: Array<[string, string]> = [
  ['a-single-keyword-routes', 'a keyword picks its handler'],
  ['matching-is-case-insensitive', 'capitalisation does not change the route'],
  ['the-first-declared-route-wins', 'declaration order decides, not match count'],
  ['matching-is-on-whole-words', 'creditor is not credit'],
  ['no-match-falls-back', 'an unrecognised request goes to a person'],
  ['an-empty-request-falls-back', 'an empty request is not a match'],
  ['punctuation-does-not-block-a-match', 'a question mark is not part of the word'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.equal(run(entry), entry.route);
  });
}

test('every request routes somewhere', () => {
  const names = new Set([...fixture.routes.map((r) => r.name), fixture.fallback]);
  for (const entry of fixture.cases) {
    assert.ok(names.has(run(entry)), `${entry.id}: routed to an unknown handler`);
  }
});

test('routing is a pure function of the request', () => {
  for (const entry of fixture.cases) {
    assert.equal(run(entry), run(entry), `${entry.id}: two calls disagreed`);
  }
});
