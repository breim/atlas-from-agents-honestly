import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { ceiling as Ceiling } from './start.ts';

interface Case {
  id: string;
  sources: string[];
  ceiling: string;
}

const fixture = expected<{ chapter: string; order: string[]; cases: Case[] }>(import.meta.url);
const { ceiling } = await loadImpl<{ ceiling: typeof Ceiling }>(import.meta.url);

const run = (entry: Case) => ceiling(entry.sources, fixture.order);
const level = (mark: string) => Math.max(0, fixture.order.indexOf(mark));

const cases: Array<[string, string]> = [
  ['an-empty-context-is-fully-trusted', 'nothing retrieved is nothing to distrust'],
  ['a-single-reviewed-source-caps-at-reviewed', 'the ceiling follows the source'],
  ['one-external-source-drags-the-whole-context-down', 'one untrusted passage caps everything'],
  ['position-does-not-matter', 'where the untrusted chunk sits is irrelevant'],
  ['quantity-does-not-matter', 'three trusted sources do not outvote one hostile one'],
  ['all-system-sources-stay-at-system', 'a wholly trusted context stays trusted'],
  ['an-unknown-marking-is-treated-as-external', 'unnamed provenance fails closed'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.equal(run(entry), entry.ceiling);
  });
}

test('the ceiling is always a level from the declared order', () => {
  for (const entry of fixture.cases) {
    assert.ok(fixture.order.includes(run(entry)), `${entry.id}: returned a level nobody declared`);
  }
});

test('the ceiling is never above any source in the context', () => {
  for (const entry of fixture.cases) {
    const result = level(run(entry));
    for (const source of entry.sources) {
      assert.ok(result <= level(source), `${entry.id}: ranked above its own source ${source}`);
    }
  }
});

test('adding a source can only lower the ceiling', () => {
  for (const entry of fixture.cases) {
    const before = level(run(entry));
    for (const added of fixture.order) {
      const after = level(ceiling([...entry.sources, added], fixture.order));
      assert.ok(after <= before, `${entry.id}: adding ${added} raised the ceiling`);
    }
  }
});
