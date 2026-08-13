import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Entry, select as Select } from './start.ts';

interface Case {
  id: string;
  threshold: number;
  keepLast: number;
  history: Entry[];
  kept: string[];
}

const fixture = expected<{ chapter: string; cases: Case[] }>(import.meta.url);
const { select } = await loadImpl<{ select: typeof Select }>(import.meta.url);

const run = (entry: Case) => select(entry.history, entry.threshold, entry.keepLast);

const cases: Array<[string, string]> = [
  ['everything-scores-above-the-threshold', 'a relevant history is kept whole'],
  ['drops-what-scores-below', 'an irrelevant middle turn is dropped'],
  ['the-tail-is-kept-regardless-of-score', 'the tail outranks the scorer'],
  ['the-threshold-is-inclusive', 'a score exactly on the threshold is kept'],
  ['kept-entries-hold-their-original-order', 'survivors are returned in transcript order'],
  ['a-tail-longer-than-the-history-keeps-everything', 'an oversized tail is not an index error'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.kept);
  });
}

test('the last keepLast turns are always present', () => {
  for (const entry of fixture.cases) {
    const kept = run(entry);
    const tail = entry.history.slice(Math.max(0, entry.history.length - entry.keepLast));
    for (const turn of tail) {
      assert.ok(kept.includes(turn.id), `${entry.id}: tail turn ${turn.id} was dropped`);
    }
  }
});

test('nothing below the threshold survives outside the tail', () => {
  for (const entry of fixture.cases) {
    const kept = run(entry);
    const tailStart = Math.max(0, entry.history.length - entry.keepLast);
    entry.history.forEach((turn, index) => {
      if (index >= tailStart || turn.score >= entry.threshold) return;
      assert.ok(!kept.includes(turn.id), `${entry.id}: kept ${turn.id} at ${turn.score}`);
    });
  }
});
