import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { delays as Delays } from './start.ts';

interface Case {
  id: string;
  randoms: number[];
  delays: number[];
}

const fixture = expected<{ chapter: string; baseMs: number; capMs: number; cases: Case[] }>(
  import.meta.url,
);
const { delays } = await loadImpl<{ delays: typeof Delays }>(import.meta.url);

const run = (entry: Case) => delays(entry.randoms, fixture.baseMs, fixture.capMs);
const window = (attempt: number) => Math.min(fixture.baseMs * 2 ** attempt, fixture.capMs);

const cases: Array<[string, string]> = [
  ['the-first-delay-is-drawn-from-the-base', 'the first window is the base'],
  ['the-window-doubles-each-attempt', 'the window grows exponentially'],
  ['the-window-stops-doubling-at-the-cap', 'the cap bounds the tail'],
  ['full-jitter-can-draw-zero', 'full jitter reaches the bottom of its window'],
  ['jitter-spreads-attempts-across-the-window', 'a draw scales with its own window'],
  ['the-delay-is-floored-not-rounded', 'the delay never rounds up past its window'],
  ['no-attempts-produce-no-delays', 'no attempts is no waiting'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.delays);
  });
}

test('one delay per attempt', () => {
  for (const entry of fixture.cases) {
    assert.equal(run(entry).length, entry.randoms.length, `${entry.id}: attempt count changed`);
  }
});

test('every delay sits inside its own window', () => {
  for (const entry of fixture.cases) {
    run(entry).forEach((delay, index) => {
      assert.ok(delay >= 0, `${entry.id}: negative delay`);
      assert.ok(delay <= window(index), `${entry.id}: attempt ${index + 1} exceeded its window`);
    });
  }
});

test('no delay ever exceeds the cap', () => {
  for (const entry of fixture.cases) {
    for (const delay of run(entry)) {
      assert.ok(delay <= fixture.capMs, `${entry.id}: ${delay} is over the cap`);
    }
  }
});

test('a larger draw never produces a smaller delay', () => {
  for (const entry of fixture.cases) {
    if (entry.randoms.length === 0) continue;
    const bigger = delays(
      entry.randoms.map((draw) => Math.min(1, draw + 0.001)),
      fixture.baseMs,
      fixture.capMs,
    );
    run(entry).forEach((delay, index) => {
      assert.ok(bigger[index] >= delay, `${entry.id}: a bigger draw waited less`);
    });
  }
});
