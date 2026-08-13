import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Compaction, Entry, compact as Compact } from './start.ts';

interface Case {
  id: string;
  budget: number;
  entries: Entry[];
  result: Compaction;
}

const fixture = expected<{ chapter: string; cases: Case[] }>(import.meta.url);
const { compact } = await loadImpl<{ compact: typeof Compact }>(import.meta.url);

const cases: Array<[string, string]> = [
  ['everything-fits', 'nothing is dropped while the transcript fits'],
  ['drops-the-oldest-first', 'the oldest droppable entry goes first'],
  ['pinned-survives-the-cut', 'a pinned entry in the middle is still pinned'],
  ['pinned-alone-exceeds-the-budget', 'a pinned entry is kept even when it blows the budget'],
  ['kept-entries-hold-their-original-order', 'survivors are returned in transcript order'],
  ['skips-an-oversized-newer-entry', 'an oversized recent entry is skipped, not paid for'],
  ['budget-of-zero-keeps-only-what-is-pinned', 'a budget of zero still keeps the system prompt'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(compact(entry.entries, entry.budget), entry.result);
  });
}

test('every entry is either kept or dropped, never both and never neither', () => {
  for (const entry of fixture.cases) {
    const { kept, dropped } = compact(entry.entries, entry.budget);
    assert.deepEqual(
      [...kept, ...dropped].sort(),
      entry.entries.map((e) => e.id).sort(),
      `${entry.id}: the partition lost or duplicated an entry`,
    );
  }
});

test('no pinned entry is ever dropped', () => {
  for (const entry of fixture.cases) {
    const { dropped } = compact(entry.entries, entry.budget);
    const pinned = entry.entries.filter((e) => e.pinned).map((e) => e.id);
    for (const id of pinned) assert.ok(!dropped.includes(id), `${entry.id}: dropped pinned ${id}`);
  }
});

test('the droppable part stays within budget', () => {
  for (const entry of fixture.cases) {
    const { kept } = compact(entry.entries, entry.budget);
    const cost = entry.entries
      .filter((e) => kept.includes(e.id))
      .reduce((sum, e) => sum + e.tokens, 0);
    const pinnedCost = entry.entries.filter((e) => e.pinned).reduce((sum, e) => sum + e.tokens, 0);
    assert.ok(
      cost <= Math.max(entry.budget, pinnedCost),
      `${entry.id}: kept ${cost} tokens against a budget of ${entry.budget}`,
    );
  }
});
