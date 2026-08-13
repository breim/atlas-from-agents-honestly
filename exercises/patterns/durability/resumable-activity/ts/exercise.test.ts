import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Attempt, process as Process } from './start.ts';

interface Case {
  id: string;
  items: string[];
  checkpoint: string | null;
  failAt: string | null;
  result: Attempt;
}

const fixture = expected<{ chapter: string; cases: Case[] }>(import.meta.url);
const { process } = await loadImpl<{ process: typeof Process }>(import.meta.url);

const run = (entry: Case) => process(entry.items, entry.checkpoint, entry.failAt);

const cases: Array<[string, string]> = [
  ['a-fresh-attempt-starts-at-the-beginning', 'no checkpoint means all the work'],
  ['a-retry-resumes-after-the-checkpoint', 'the checkpointed item is not redone'],
  ['a-failure-checkpoints-what-completed', 'the mark is the last success, not the failure'],
  ['a-retry-after-a-failure-finishes-the-work', 'the second attempt completes the batch'],
  ['no-item-is-ever-processed-twice', 'a finished batch retries into no work'],
  ['failing-on-the-first-item-keeps-the-old-checkpoint', 'no progress means no new mark'],
  ['an-unknown-checkpoint-restarts-from-the-beginning', 'an unrecognised mark reprocesses'],
  ['no-items-is-a-success-with-no-work', 'an empty batch succeeds'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('nothing at or before the checkpoint is reprocessed', () => {
  for (const entry of fixture.cases) {
    if (entry.checkpoint === null) continue;
    const cut = entry.items.indexOf(entry.checkpoint);
    if (cut === -1) continue;
    for (const item of entry.items.slice(0, cut + 1)) {
      assert.ok(!run(entry).processed.includes(item), `${entry.id}: reprocessed ${item}`);
    }
  }
});

test('the returned checkpoint is the last item this attempt completed', () => {
  for (const entry of fixture.cases) {
    const { processed, checkpoint } = run(entry);
    if (processed.length === 0) continue;
    assert.equal(checkpoint, processed.at(-1), `${entry.id}: the mark is not the last success`);
  }
});

test('a failed attempt never marks the item that failed', () => {
  for (const entry of fixture.cases) {
    const outcome = run(entry);
    if (outcome.ok) continue;
    assert.notEqual(outcome.checkpoint, entry.failAt, `${entry.id}: checkpointed the failure`);
    assert.ok(!outcome.processed.includes(entry.failAt!), `${entry.id}: counted the failure as done`);
  }
});

test('two attempts together process each item exactly once', () => {
  for (const entry of fixture.cases) {
    const first = run(entry);
    if (first.ok) continue;
    const second = process(entry.items, first.checkpoint, null);
    const combined = [...first.processed, ...second.processed];
    const remaining = entry.items.slice(
      entry.checkpoint === null ? 0 : entry.items.indexOf(entry.checkpoint) + 1,
    );
    assert.deepEqual(combined, remaining, `${entry.id}: the two attempts did not tile the batch`);
  }
});
