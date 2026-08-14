import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Assembled, Rejected, Tool, assemble as Assemble } from './start.ts';

interface Case {
  id: string;
  catalogue?: 'deferredOnly' | 'searchOnly';
  query: string;
  limit: number;
  result: Assembled | Rejected;
}

interface Fixture {
  chapter: string;
  catalogue: Tool[];
  deferredOnly: Tool[];
  searchOnly: Tool[];
  cases: Case[];
}

const fixture = expected<Fixture>(import.meta.url);
const { assemble } = await loadImpl<{ assemble: typeof Assemble }>(import.meta.url);

const catalogueFor = (entry: Case) => (entry.catalogue ? fixture[entry.catalogue] : fixture.catalogue);
const run = (entry: Case) => assemble(catalogueFor(entry), entry.query, entry.limit);
const accepted = () => fixture.cases.filter((entry) => run(entry).ok);
const words = (query: string) => new Set(query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));

const cases: Array<[string, string]> = [
  ['a-query-that-matches-nothing-loads-nothing', 'an empty search costs only the round trip'],
  ['matching-tools-are-loaded-strongest-first', 'the best match arrives first'],
  ['the-limit-drops-the-weakest-match-not-the-last-one', 'the cap is a ranking, not a truncation'],
  ['a-generous-limit-is-not-padded-with-non-matches', 'spare room is not a reason to spend it'],
  ['a-namespace-prefix-alone-finds-the-server', 'the prefix is what makes the index searchable'],
  ['a-resident-tool-is-never-loaded-a-second-time', 'what is already there is not reloaded'],
  ['a-catalogue-that-defers-everything-is-rejected', 'an invisible agent has nothing to reason from'],
  ['a-search-tool-with-nothing-visible-is-rejected', 'searching implies something worth finding'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('the resident prefix is identical for every query', () => {
  const prefixes = accepted().map((entry) => run(entry) as Assembled);
  for (const result of prefixes) {
    assert.deepEqual(result.resident, prefixes[0].resident, 'the cached prefix moved between queries');
    assert.equal(result.prefixTokens, prefixes[0].prefixTokens, 'the prefix cost moved between queries');
  }
});

test('a resident tool is never appended as well', () => {
  for (const entry of accepted()) {
    const result = run(entry) as Assembled;
    for (const name of result.appended) {
      assert.ok(!result.resident.includes(name), `${entry.id}: loaded the resident ${name} again`);
    }
  }
});

test('the number of appended tools never exceeds the limit', () => {
  for (const entry of accepted()) {
    const { appended } = run(entry) as Assembled;
    assert.ok(appended.length <= entry.limit, `${entry.id}: loaded ${appended.length} tools`);
  }
});

test('every appended tool shares a word with the query', () => {
  for (const entry of accepted()) {
    const query = words(entry.query);
    for (const name of (run(entry) as Assembled).appended) {
      const tool = catalogueFor(entry).find((candidate) => candidate.name === name);
      assert.ok(tool, `${entry.id}: appended ${name}, which is not in the catalogue`);
      const overlap = tool.keywords.some((keyword) => query.has(keyword));
      assert.ok(overlap, `${entry.id}: loaded ${name}, which the query never asked for`);
    }
  }
});

test('the token count covers exactly the resident and appended tools', () => {
  for (const entry of accepted()) {
    const result = run(entry) as Assembled;
    const loaded = [...result.resident, ...result.appended];
    const cost = catalogueFor(entry)
      .filter((tool) => loaded.includes(tool.name))
      .reduce((sum, tool) => sum + tool.tokens, 0);
    assert.equal(result.totalTokens, cost, `${entry.id}: the accounting does not match the tools`);
  }
});

test('raising the limit only ever appends more, and appends it at the end', () => {
  for (const entry of accepted()) {
    const tighter = assemble(catalogueFor(entry), entry.query, entry.limit) as Assembled;
    const looser = assemble(catalogueFor(entry), entry.query, entry.limit + 1) as Assembled;
    assert.ok(looser.appended.length >= tighter.appended.length, `${entry.id}: more room loaded fewer tools`);
    assert.deepEqual(
      looser.appended.slice(0, tighter.appended.length),
      tighter.appended,
      `${entry.id}: more room reordered what was already loaded`,
    );
  }
});

test('a catalogue with nothing resident is rejected whatever the query', () => {
  for (const entry of fixture.cases) {
    const result = assemble(fixture.deferredOnly, entry.query, entry.limit);
    assert.equal(result.ok, false, `${entry.id}: a fully deferred catalogue was accepted`);
  }
});
