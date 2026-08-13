import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Pricing, Usage, costMicros as CostMicros } from './start.ts';

interface Case {
  id: string;
  usage: Usage;
  micros: number;
}

const fixture = expected<{ chapter: string; pricing: Pricing; cases: Case[] }>(import.meta.url);
const { costMicros } = await loadImpl<{ costMicros: typeof CostMicros }>(import.meta.url);

const cost = (id: string) => costMicros(findCase(fixture, id).usage, fixture.pricing);
const micros = (id: string) => findCase(fixture, id).micros;

test('uncached usage bills input and output at their own rates', () => {
  assert.equal(cost('uncached'), micros('uncached'));
});

test('output-dominates: a blended rate cannot produce this number', () => {
  assert.equal(cost('output-dominates'), micros('output-dominates'));
});

test('cache-read tokens bill at a tenth of an input token', () => {
  assert.equal(cost('cache-read'), micros('cache-read'));
});

test('cache-write tokens bill above an input token', () => {
  assert.equal(cost('cache-write'), micros('cache-write'));
});

test('halves-round-up rather than to even', () => {
  assert.equal(cost('halves-round-up'), micros('halves-round-up'));
});

test('empty usage is free, not a division by zero', () => {
  assert.equal(cost('empty'), micros('empty'));
});

test('every rate is load-bearing', () => {
  for (const rate of ['input', 'output', 'cacheWrite', 'cacheRead'] as const) {
    const usage: Usage = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, [rate]: 1000 };
    assert.equal(
      costMicros(usage, fixture.pricing),
      Math.floor(1000 * fixture.pricing[rate] + 0.5),
      `${rate} is not being charged`,
    );
  }
});
