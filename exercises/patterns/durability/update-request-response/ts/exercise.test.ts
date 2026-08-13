import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Applied, State, Update, applyUpdates as ApplyUpdates } from './start.ts';

interface Case {
  id: string;
  updates: Update[];
  result: Applied;
}

const fixture = expected<{ chapter: string; initial: State; cases: Case[] }>(import.meta.url);
const { applyUpdates } = await loadImpl<{ applyUpdates: typeof ApplyUpdates }>(import.meta.url);

const run = (entry: Case) => applyUpdates(fixture.initial, entry.updates);

const cases: Array<[string, string]> = [
  ['an-accepted-update-mutates-and-answers', 'a valid update changes state and returns'],
  ['a-rejected-update-leaves-the-state-untouched', 'validation happens before mutation'],
  ['an-unknown-update-is-rejected-not-applied', 'an unrecognised kind changes nothing'],
  ['a-rejection-does-not-stop-the-next-update', 'the caller can correct and retry'],
  ['accepted-updates-accumulate', 'successive updates compound'],
  ['closing-is-an-update-too', 'a lifecycle change is just another update'],
  ['a-closed-workflow-refuses-further-credit', 'the check runs before the credit is added'],
  ['no-updates-leave-the-workflow-as-it-started', 'no updates is no change'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('the initial state is never mutated', () => {
  const snapshot = structuredClone(fixture.initial);
  for (const entry of fixture.cases) run(entry);
  assert.deepEqual(fixture.initial, snapshot);
});

test('one response per update, always', () => {
  for (const entry of fixture.cases) {
    assert.equal(
      run(entry).responses.length,
      entry.updates.length,
      `${entry.id}: an update went unanswered`,
    );
  }
});

test('a run of only rejections changes nothing', () => {
  for (const entry of fixture.cases) {
    const { state, responses } = run(entry);
    if (responses.some((response) => response.ok)) continue;
    assert.deepEqual(state, fixture.initial, `${entry.id}: rejections still moved the state`);
  }
});

test('credit never decreases and never goes negative', () => {
  for (const entry of fixture.cases) {
    const { state } = run(entry);
    assert.ok(state.creditCents >= fixture.initial.creditCents, `${entry.id}: credit went backwards`);
    assert.ok(state.creditCents >= 0, `${entry.id}: negative credit`);
  }
});
