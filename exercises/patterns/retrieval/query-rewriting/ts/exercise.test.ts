import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { rewrite as Rewrite } from './start.ts';

interface Case {
  id: string;
  query: string;
  rewritten: string;
}

const fixture = expected<{ chapter: string; synonyms: Record<string, string[]>; cases: Case[] }>(
  import.meta.url,
);
const { rewrite } = await loadImpl<{ rewrite: typeof Rewrite }>(import.meta.url);

const cases: Array<[string, string]> = [
  ['an-unknown-term-passes-through', 'a term with no synonyms is left alone'],
  ['expands-a-known-term', 'a known term brings its synonyms'],
  ['expands-several-terms-in-query-order', 'additions follow the order of their triggers'],
  ['never-duplicates-a-term-already-present', 'a synonym already in the query is not repeated'],
  ['a-repeated-term-expands-once', 'a repeated trigger expands once'],
  ['an-empty-query-stays-empty', 'an empty query is not a stray space'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.equal(rewrite(entry.query, fixture.synonyms), entry.rewritten);
  });
}

test('the original terms always come first, in order', () => {
  for (const entry of fixture.cases) {
    const originals = [...new Set(entry.query.split(/\s+/).filter(Boolean))];
    const out = rewrite(entry.query, fixture.synonyms).split(/\s+/).filter(Boolean);
    assert.deepEqual(out.slice(0, originals.length), originals, `${entry.id}: the query was reordered`);
  }
});

test('no term appears twice', () => {
  for (const entry of fixture.cases) {
    const out = rewrite(entry.query, fixture.synonyms).split(/\s+/).filter(Boolean);
    assert.equal(new Set(out).size, out.length, `${entry.id}: ${out.join(', ')}`);
  }
});

test('expansion only ever adds', () => {
  for (const entry of fixture.cases) {
    const out = new Set(rewrite(entry.query, fixture.synonyms).split(/\s+/).filter(Boolean));
    for (const term of entry.query.split(/\s+/).filter(Boolean)) {
      assert.ok(out.has(term), `${entry.id}: dropped the original term ${term}`);
    }
  }
});
