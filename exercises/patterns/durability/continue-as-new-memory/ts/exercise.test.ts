import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { RunState, run as Run } from './start.ts';

interface Case {
  id: string;
  events: string[];
  result: RunState;
}

const fixture = expected<{
  chapter: string;
  maxEvents: number;
  keepRecent: number;
  cases: Case[];
}>(import.meta.url);
const { run } = await loadImpl<{ run: typeof Run }>(import.meta.url);

const execute = (entry: Case) => run(entry.events, fixture.maxEvents, fixture.keepRecent);

const cases: Array<[string, string]> = [
  ['a-short-run-never-continues', 'a conversation inside the limit stays in one run'],
  ['reaching-the-limit-continues-as-new', 'hitting the limit starts a fresh history'],
  ['the-new-run-starts-from-the-carried-state', 'the next event lands in the new run'],
  ['a-long-conversation-continues-more-than-once', 'continuations compound'],
  ['nothing-is-lost-across-a-continuation', 'no event falls through the boundary'],
  ['an-empty-conversation-is-generation-zero', 'nothing said is nothing carried'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(execute(entry), entry.result);
  });
}

test('summary and recent together are every event, in order', () => {
  for (const entry of fixture.cases) {
    const { summary, recent } = execute(entry);
    assert.deepEqual([...summary, ...recent], entry.events, `${entry.id}: memory was amputated`);
  }
});

test('recent never exceeds what the new run carries', () => {
  for (const entry of fixture.cases) {
    assert.ok(
      execute(entry).recent.length <= fixture.keepRecent,
      `${entry.id}: carried more than keepRecent`,
    );
  }
});

test('the current history never reaches the limit', () => {
  for (const entry of fixture.cases) {
    assert.ok(
      execute(entry).events < fixture.maxEvents,
      `${entry.id}: a run was left sitting at its history limit`,
    );
  }
});
