import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Batch, nextBatch as NextBatch } from './start.ts';

interface Case {
  id: string;
  size: number;
  cursor: string | null;
  result: Batch;
}

const fixture = expected<{ chapter: string; items: string[]; cases: Case[] }>(import.meta.url);
const { nextBatch } = await loadImpl<{ nextBatch: typeof NextBatch }>(import.meta.url);

const run = (entry: Case) => nextBatch(fixture.items, entry.size, entry.cursor);

const cases: Array<[string, string]> = [
  ['the-first-batch-starts-at-the-beginning', 'no cursor means start at the top'],
  ['a-cursor-resumes-after-the-last-item-handed-out', 'the cursor is not re-handed out'],
  ['the-final-batch-can-be-short', 'a partial batch is a valid batch'],
  ['a-batch-that-exactly-consumes-the-rest-is-done', 'landing on the end reports done'],
  ['a-cursor-at-the-end-yields-nothing', 'an empty batch is a terminal state'],
  ['a-batch-larger-than-the-remainder-does-not-overrun', 'an oversized batch takes what exists'],
  ['an-unknown-cursor-restarts-from-the-beginning', 'a stale id restarts rather than skips'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('a batch never exceeds its size', () => {
  for (const entry of fixture.cases) {
    assert.ok(run(entry).batch.length <= entry.size, `${entry.id}: over the batch size`);
  }
});

test('a batch is a contiguous slice of the collection, in order', () => {
  for (const entry of fixture.cases) {
    const { batch } = run(entry);
    if (batch.length === 0) continue;
    const start = fixture.items.indexOf(batch[0]);
    assert.deepEqual(
      batch,
      fixture.items.slice(start, start + batch.length),
      `${entry.id}: the batch is not contiguous`,
    );
  }
});

test('iterating from the start visits every item exactly once', () => {
  for (const size of [1, 2, 3, 5, 99]) {
    const seen: string[] = [];
    let cursor: string | null = null;
    let done = false;

    while (!done) {
      const step: Batch = nextBatch(fixture.items, size, cursor);
      seen.push(...step.batch);
      cursor = step.cursor;
      done = step.done;
    }

    assert.deepEqual(seen, fixture.items, `size ${size}: the walk skipped or repeated an item`);
  }
});
