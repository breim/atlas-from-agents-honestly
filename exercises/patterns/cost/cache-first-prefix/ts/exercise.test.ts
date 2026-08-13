import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Block, Priced, Pricing, price as Price } from './start.ts';

interface Case {
  id: string;
  previous: Block[];
  current: Block[];
  result: Priced;
}

const fixture = expected<{ chapter: string; pricing: Pricing; cases: Case[] }>(import.meta.url);
const { price } = await loadImpl<{ price: typeof Price }>(import.meta.url);

const run = (entry: Case) => price(entry.previous, entry.current, fixture.pricing);

const cases: Array<[string, string]> = [
  ['a-cold-request-pays-to-write-the-whole-cache', 'a first request caches nothing'],
  ['an-identical-request-reads-everything-from-cache', 'a repeat request is cheap'],
  ['appending-only-pays-for-what-was-appended', 'appending preserves the prefix'],
  ['changing-the-first-block-invalidates-everything', 'the prefix breaks at the first difference'],
  ['a-tiny-change-at-the-front-costs-the-whole-suffix', 'ten tokens can cost a thousand'],
  ['a-block-that-shrinks-breaks-the-prefix-there', 'dropping a trailing block keeps the prefix'],
  ['an-empty-request-costs-nothing', 'nothing sent is nothing billed'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('cached plus fresh is always the whole request', () => {
  for (const entry of fixture.cases) {
    const { cached, fresh } = run(entry);
    const total = entry.current.reduce((sum, block) => sum + block.tokens, 0);
    assert.equal(cached + fresh, total, `${entry.id}: tokens went missing`);
  }
});

test('nothing after the first difference is ever counted as cached', () => {
  for (const entry of fixture.cases) {
    const { cached } = run(entry);
    let shared = 0;
    while (
      shared < entry.current.length &&
      JSON.stringify(entry.previous[shared]) === JSON.stringify(entry.current[shared])
    ) {
      shared += 1;
    }
    const cacheable = entry.current.slice(0, shared).reduce((sum, b) => sum + b.tokens, 0);
    assert.equal(cached, cacheable, `${entry.id}: cached beyond the shared prefix`);
  }
});

test('a cache hit is always cheaper than paying fresh for the same tokens', () => {
  for (const entry of fixture.cases) {
    const { cached, micros } = run(entry);
    if (cached === 0) continue;
    const allFresh = price([], entry.current, fixture.pricing).micros;
    assert.ok(micros < allFresh, `${entry.id}: caching did not save anything`);
  }
});

test('breaking the prefix at the front never costs less than breaking it later', () => {
  for (const entry of fixture.cases) {
    if (entry.current.length < 2) continue;
    const broken = [{ ...entry.current[0], hash: 'BROKEN' }, ...entry.current.slice(1)];
    assert.ok(
      price(entry.previous, broken, fixture.pricing).micros >= run(entry).micros,
      `${entry.id}: breaking the first block got cheaper`,
    );
  }
});
