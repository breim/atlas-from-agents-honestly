import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Outcome, Round, revise as Revise } from './start.ts';

interface Case {
  id: string;
  draft: string;
  rounds: Round[];
  result: Outcome;
}

const fixture = expected<{ chapter: string; cases: Case[] }>(import.meta.url);
const { revise } = await loadImpl<{ revise: typeof Revise }>(import.meta.url);

const run = (entry: Case) => revise(entry.draft, entry.rounds);

const cases: Array<[string, string]> = [
  ['a-clean-draft-is-accepted-unchanged', 'nothing to revise means nothing changes'],
  ['a-revision-that-resolves-a-finding-is-accepted', 'a genuine fix is taken'],
  ['a-revision-that-introduces-a-finding-is-rejected', 'a regression is refused'],
  ['a-revision-that-resolves-nothing-is-rejected', 'churn is not improvement'],
  ['a-rejected-revision-does-not-end-the-loop', 'a bad round is not terminal'],
  ['a-later-revision-builds-on-the-accepted-one', 'accepted revisions compound'],
  ['a-trade-off-revision-is-still-a-rejection', 'two fixes do not buy one regression'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('the returned draft is the original or an accepted revision', () => {
  for (const entry of fixture.cases) {
    const outcome = run(entry);
    const legitimate = new Set([entry.draft, ...outcome.accepted]);
    assert.ok(legitimate.has(outcome.draft), `${entry.id}: returned a draft nobody accepted`);
  }
});

test('no revision that introduced a finding was ever accepted', () => {
  for (const entry of fixture.cases) {
    const { accepted } = run(entry);
    for (const round of entry.rounds) {
      if (round.introduces.length === 0) continue;
      assert.ok(!accepted.includes(round.draft), `${entry.id}: accepted a regression`);
    }
  }
});

test('every round is judged exactly once', () => {
  for (const entry of fixture.cases) {
    const { accepted, rejected } = run(entry);
    assert.deepEqual(
      [...accepted, ...rejected].sort(),
      entry.rounds.map((round) => round.draft).sort(),
      `${entry.id}: a round was skipped or double-counted`,
    );
  }
});
