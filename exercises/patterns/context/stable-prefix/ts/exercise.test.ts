import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Block, Ordering, order as Order } from './start.ts';

interface Case {
  id: string;
  blocks: Block[];
  result: Ordering;
}

const fixture = expected<{ chapter: string; cases: Case[] }>(import.meta.url);
const { order } = await loadImpl<{ order: typeof Order }>(import.meta.url);

const cases: Array<[string, string]> = [
  ['already-in-stable-order', 'a prompt already in order is left alone'],
  ['moves-a-volatile-block-to-the-back', 'a timestamp above the system prompt costs the whole prefix'],
  ['preserves-relative-order-within-each-group', 'the sort is stable within both groups'],
  ['all-volatile-has-no-cacheable-prefix', 'nothing stable means nothing cached'],
  ['all-stable-caches-everything', 'nothing volatile means the whole prompt caches'],
  ['an-empty-prompt-caches-nothing', 'an empty prompt is zero, not a crash'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(order(entry.blocks), entry.result);
  });
}

test('every stable block precedes every volatile one', () => {
  for (const entry of fixture.cases) {
    const { ordered } = order(entry.blocks);
    const volatility = ordered.map((id) => entry.blocks.find((b) => b.id === id)!.volatile);
    const firstVolatile = volatility.indexOf(true);
    if (firstVolatile === -1) continue;
    assert.ok(
      volatility.slice(firstVolatile).every(Boolean),
      `${entry.id}: a stable block sits after a volatile one`,
    );
  }
});

test('the ordering is a permutation, not a filter', () => {
  for (const entry of fixture.cases) {
    const { ordered } = order(entry.blocks);
    assert.deepEqual(
      [...ordered].sort(),
      entry.blocks.map((block) => block.id).sort(),
      `${entry.id}: a block was lost or invented`,
    );
  }
});

test('prefixTokens counts exactly the stable blocks', () => {
  for (const entry of fixture.cases) {
    const stable = entry.blocks.filter((block) => !block.volatile);
    assert.equal(
      order(entry.blocks).prefixTokens,
      stable.reduce((sum, block) => sum + block.tokens, 0),
      `${entry.id}: prefix accounting disagrees with the blocks`,
    );
  }
});
