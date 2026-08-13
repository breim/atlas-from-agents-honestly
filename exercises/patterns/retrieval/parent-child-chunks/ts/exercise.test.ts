import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Chunk, expand as Expand } from './start.ts';

interface Case {
  id: string;
  hits: string[];
  expanded: string[];
}

const fixture = expected<{
  chapter: string;
  chunks: Chunk[];
  parents: Record<string, string>;
  cases: Case[];
}>(import.meta.url);
const { expand } = await loadImpl<{ expand: typeof Expand }>(import.meta.url);

const run = (entry: Case) => expand(entry.hits, fixture.chunks, fixture.parents);

const cases: Array<[string, string]> = [
  ['a-hit-returns-its-parent', 'the model reads the clause, not the sentence'],
  ['two-hits-sharing-a-parent-return-it-once', 'one clause is sent once'],
  ['parents-come-back-in-first-hit-order', "the retriever's ranking survives expansion"],
  ['a-chunk-without-a-parent-returns-itself', 'an orphan chunk is its own parent'],
  ['an-unknown-hit-is-skipped', 'a stale id is skipped, not thrown'],
  ['no-hits-expand-to-nothing', 'no hits is an empty list'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.expanded);
  });
}

test('no passage is ever sent twice', () => {
  for (const entry of fixture.cases) {
    const out = run(entry);
    assert.equal(new Set(out).size, out.length, `${entry.id}: a passage was duplicated`);
  }
});

test('every returned passage traces to a hit', () => {
  const byId = new Map(fixture.chunks.map((chunk) => [chunk.id, chunk]));
  for (const entry of fixture.cases) {
    const reachable = new Set(
      entry.hits
        .map((hit) => byId.get(hit))
        .filter(Boolean)
        .map((chunk) => (chunk!.parentId ? fixture.parents[chunk!.parentId] : chunk!.text)),
    );
    for (const text of run(entry)) {
      assert.ok(reachable.has(text), `${entry.id}: returned a passage nothing hit`);
    }
  }
});
