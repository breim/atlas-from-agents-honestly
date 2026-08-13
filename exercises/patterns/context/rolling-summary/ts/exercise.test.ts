import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { State, append as Append } from './start.ts';

interface Case {
  id: string;
  keepRecent: number;
  turns: string[];
  state: State;
}

const fixture = expected<{ chapter: string; cases: Case[] }>(import.meta.url);
const { append } = await loadImpl<{ append: typeof Append }>(import.meta.url);

const fold = (entry: Case): State =>
  entry.turns.reduce<State>(
    (state, turn) => append(state, turn, entry.keepRecent),
    { summary: [], recent: [] },
  );

const cases: Array<[string, string]> = [
  ['under-the-window', 'nothing folds while the window has room'],
  ['exactly-the-window', 'landing exactly on the window does not fold'],
  ['folds-the-oldest', 'one turn past the window folds exactly one turn'],
  ['folds-in-arrival-order', 'folded turns keep their arrival order'],
  ['window-of-one', 'a window of one keeps only the latest turn'],
  ['window-of-zero-folds-everything', 'a window of zero folds on arrival'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(fold(entry), entry.state);
  });
}

test('no turn is ever lost or duplicated', () => {
  for (const entry of fixture.cases) {
    const { summary, recent } = fold(entry);
    assert.deepEqual([...summary, ...recent], entry.turns, `${entry.id}: turns went missing or moved`);
  }
});

test('recent never exceeds the window', () => {
  for (const entry of fixture.cases) {
    const { recent } = fold(entry);
    assert.ok(recent.length <= entry.keepRecent, `${entry.id}: ${recent.length} over ${entry.keepRecent}`);
  }
});
