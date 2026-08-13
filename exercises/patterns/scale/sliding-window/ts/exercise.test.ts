import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Event, window as Window } from './start.ts';

interface Case {
  id: string;
  now: number;
  events: Event[];
  kept: string[];
}

const fixture = expected<{ chapter: string; windowMs: number; cases: Case[] }>(import.meta.url);
const { window } = await loadImpl<{ window: typeof Window }>(import.meta.url);

const run = (entry: Case) => window(entry.events, entry.now, fixture.windowMs);

const cases: Array<[string, string]> = [
  ['everything-inside-the-window-is-kept', 'recent events stay'],
  ['an-event-older-than-the-window-falls-out', 'old events leave'],
  ['the-edge-of-the-window-is-inclusive', 'exactly at the edge is inside'],
  ['one-millisecond-past-the-edge-falls-out', 'one millisecond older is outside'],
  ['kept-events-hold-their-original-order', 'the window filters, it does not sort'],
  ['an-event-in-the-future-is-kept', 'forward clock skew is not stale'],
  ['everything-can-fall-out', 'an empty window is a valid answer'],
  ['an-empty-window-keeps-nothing', 'no events is no events'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.kept);
  });
}

test('the window only ever filters, never reorders or invents', () => {
  for (const entry of fixture.cases) {
    const kept = run(entry);
    const all = entry.events.map((event) => event.id);
    assert.deepEqual(all.filter((id) => kept.includes(id)), kept, `${entry.id}: order changed`);
  }
});

test('nothing outside the window survives and nothing inside it is dropped', () => {
  for (const entry of fixture.cases) {
    const kept = new Set(run(entry));
    for (const event of entry.events) {
      const inside = event.at >= entry.now - fixture.windowMs;
      assert.equal(kept.has(event.id), inside, `${entry.id}: ${event.id} was judged wrongly`);
    }
  }
});

test('a wider window never keeps less', () => {
  for (const entry of fixture.cases) {
    assert.ok(
      window(entry.events, entry.now, fixture.windowMs * 2).length >= run(entry).length,
      `${entry.id}: widening the window dropped events`,
    );
  }
});
