import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Doc, Hit, search as Search } from './start.ts';

interface Case {
  id: string;
  query: string[];
  topK: number;
  hits: Hit[];
}

const fixture = expected<{
  chapter: string;
  idf: Record<string, number>;
  docs: Doc[];
  cases: Case[];
}>(import.meta.url);
const { search } = await loadImpl<{ search: typeof Search }>(import.meta.url);

const run = (entry: Case) => search(entry.query, fixture.docs, fixture.idf, entry.topK);

const cases: Array<[string, string]> = [
  ['a-single-term-ranks-by-frequency', 'more mentions score higher, linearly'],
  ['an-exact-identifier-dominates-the-ranking', 'a rare identifier beats a common word'],
  ['matching-more-terms-raises-the-score', 'covering more of the query scores more'],
  ['a-zero-weight-term-matches-nothing', 'a word in every document discriminates nothing'],
  ['a-term-nobody-weighted-contributes-nothing', 'an unweighted term is not a signal'],
  ['a-term-in-no-document-returns-nothing', 'no match is an empty result'],
  ['a-repeated-query-term-is-counted-once', 'repeating a term in the query changes nothing'],
  ['topk-caps-the-hits', 'topK trims the ranking'],
  ['an-empty-query-matches-nothing', 'an empty query is not a match-all'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.hits);
  });
}

test('no hit ever scores zero', () => {
  for (const entry of fixture.cases) {
    for (const hit of run(entry)) {
      assert.ok(hit.score > 0, `${entry.id}: returned ${hit.id} with no lexical signal`);
    }
  }
});

test('the score matches the term weights', () => {
  for (const entry of fixture.cases) {
    for (const hit of run(entry)) {
      const doc = fixture.docs.find((candidate) => candidate.id === hit.id)!;
      const score = [...new Set(entry.query)].reduce((sum, term) => {
        const tf = doc.terms.filter((word) => word === term).length;
        return sum + tf * (fixture.idf[term] ?? 0);
      }, 0);
      assert.equal(hit.score, score, `${entry.id}: ${hit.id} scored inconsistently`);
    }
  }
});

test('query term order never changes the ranking', () => {
  for (const entry of fixture.cases) {
    assert.deepEqual(
      search([...entry.query].reverse(), fixture.docs, fixture.idf, entry.topK),
      run(entry),
      `${entry.id}: the ranking depends on query order`,
    );
  }
});

test('results are ordered by descending score', () => {
  for (const entry of fixture.cases) {
    const hits = run(entry);
    for (let i = 1; i < hits.length; i += 1) {
      assert.ok(hits[i - 1].score >= hits[i].score, `${entry.id}: the ranking is out of order`);
    }
  }
});

test('adding a zero-weight term to the query changes nothing', () => {
  for (const entry of fixture.cases) {
    assert.deepEqual(
      search([...entry.query, 'the'], fixture.docs, fixture.idf, entry.topK),
      run(entry),
      `${entry.id}: a stop word moved the ranking`,
    );
  }
});
