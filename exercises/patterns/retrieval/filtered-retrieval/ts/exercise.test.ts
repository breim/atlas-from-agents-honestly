import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Chunk, Filter, search as Search } from './start.ts';

interface Case {
  id: string;
  filter: Filter;
  topK: number;
  chunks: Chunk[];
  hits: string[];
}

const fixture = expected<{ chapter: string; cases: Case[] }>(import.meta.url);
const { search } = await loadImpl<{ search: typeof Search }>(import.meta.url);

const run = (entry: Case) => search(entry.chunks, entry.filter, entry.topK);

const cases: Array<[string, string]> = [
  ['filters-by-tenant', "another tenant's chunk is not a result"],
  ['the-highest-scoring-chunk-can-be-filtered-out', 'similarity does not outrank permission'],
  ['every-required-tag-must-be-present', 'a partial tag match is not a match'],
  ['topk-applies-after-filtering', 'the cap counts survivors, not candidates'],
  ['an-empty-tag-requirement-matches-everything', 'no required tags is not no results'],
  ['nothing-matches', 'an empty result is a result'],
  ['ties-break-on-id', 'equal scores resolve the same way every run'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.hits);
  });
}

test('no chunk outside the filter ever appears', () => {
  for (const entry of fixture.cases) {
    for (const id of run(entry)) {
      const chunk = entry.chunks.find((c) => c.id === id)!;
      assert.equal(chunk.tenantId, entry.filter.tenantId, `${entry.id}: leaked ${id}`);
      for (const tag of entry.filter.requireTags) {
        assert.ok(chunk.tags.includes(tag), `${entry.id}: ${id} is missing the required tag ${tag}`);
      }
    }
  }
});

test('the result never exceeds topK', () => {
  for (const entry of fixture.cases) {
    assert.ok(run(entry).length <= entry.topK, `${entry.id}: over topK`);
  }
});

test('a chunk is dropped for its metadata, never for its score', () => {
  for (const entry of fixture.cases) {
    const survivors = entry.chunks.filter(
      (chunk) =>
        chunk.tenantId === entry.filter.tenantId &&
        entry.filter.requireTags.every((tag) => chunk.tags.includes(tag)),
    );
    assert.equal(
      run(entry).length,
      Math.min(survivors.length, entry.topK),
      `${entry.id}: filtering and ranking disagree on how many results exist`,
    );
  }
});
