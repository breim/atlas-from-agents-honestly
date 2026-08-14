import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Comparison, Trial, compare as Compare } from './start.ts';

interface Case {
  id: string;
  trials: Trial[];
  result: Comparison;
}

const fixture = expected<{ chapter: string; cases: Case[] }>(import.meta.url);
const { compare } = await loadImpl<{ compare: typeof Compare }>(import.meta.url);

const flip = (pick: 'a' | 'b') => (pick === 'a' ? 'b' : 'a');
// Relabelling which candidate is called A also swaps which ordering is the forward one.
const relabel = (trials: Trial[]): Trial[] =>
  trials.map((trial) => ({ id: trial.id, forward: flip(trial.reverse), reverse: flip(trial.forward) }));

const cases: Array<[string, string]> = [
  ['a-judge-that-agrees-with-itself-counts-every-trial', 'a stable judge loses nothing'],
  ['a-flipped-trial-counts-for-nobody', 'the flip is discarded, not averaged'],
  ['a-judge-that-always-picks-the-first-option-wins-nothing', 'position bias, fully expressed'],
  ['a-judge-that-always-picks-the-second-option-is-also-unusable', 'the same failure, mirrored'],
  ['an-even-split-of-consistent-wins-is-a-tie', 'no candidate is ahead'],
  ['the-loser-still-takes-some-trials', 'winning overall is not winning everywhere'],
  ['inconsistency-in-both-directions-is-still-inconsistency', 'two biases, one problem'],
  ['a-comparison-with-no-trials-decides-nothing', 'no trials, no signal'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(compare(entry.trials), entry.result);
  });
}

test('only a trial that agreed with itself counts toward a win', () => {
  for (const entry of fixture.cases) {
    const { a, b } = compare(entry.trials);
    const agreed = entry.trials.filter((trial) => trial.forward === trial.reverse).length;
    assert.equal(a + b, agreed, `${entry.id}: a flipped trial was counted`);
  }
});

test('every trial is either a win or an inconsistency', () => {
  for (const entry of fixture.cases) {
    const { a, b, inconsistent } = compare(entry.trials);
    assert.equal(a + b + inconsistent.length, entry.trials.length, entry.id);
  }
});

test('inconsistent names exactly the trials that flipped, in order', () => {
  for (const entry of fixture.cases) {
    const flipped = entry.trials.filter((trial) => trial.forward !== trial.reverse).map((trial) => trial.id);
    assert.deepEqual(compare(entry.trials).inconsistent, flipped, entry.id);
  }
});

test('every inconsistency is one direction of position bias or the other', () => {
  for (const entry of fixture.cases) {
    const { inconsistent, positionBias } = compare(entry.trials);
    assert.equal(positionBias.first + positionBias.second, inconsistent.length, entry.id);
  }
});

test('the winner is whoever took more consistent trials', () => {
  for (const entry of fixture.cases) {
    const { a, b, winner } = compare(entry.trials);
    assert.equal(winner, a === b ? 'tie' : a > b ? 'a' : 'b', `${entry.id}: the winner does not follow the count`);
  }
});

test('consistency is the share of trials that agreed with themselves', () => {
  for (const entry of fixture.cases) {
    const { a, b, consistencyBps } = compare(entry.trials);
    const share = entry.trials.length === 0 ? 0 : Math.floor(((a + b) * 10000) / entry.trials.length + 0.5);
    assert.equal(consistencyBps, share, `${entry.id}: the rate does not match the trials`);
  }
});

test('which candidate you call A does not change what the judge did', () => {
  for (const entry of fixture.cases) {
    const before = compare(entry.trials);
    const after = compare(relabel(entry.trials));
    assert.equal(after.a, before.b, `${entry.id}: relabelling moved a win`);
    assert.equal(after.b, before.a, entry.id);
    assert.deepEqual(after.inconsistent, before.inconsistent, `${entry.id}: relabelling changed the flips`);
    assert.deepEqual(after.positionBias, before.positionBias, `${entry.id}: the bias followed the label`);
    assert.equal(after.consistencyBps, before.consistencyBps, entry.id);
    assert.equal(after.winner, before.winner === 'tie' ? 'tie' : before.winner === 'a' ? 'b' : 'a', entry.id);
  }
});

test('discarding a flipped trial never changes who won', () => {
  for (const entry of fixture.cases) {
    const before = compare(entry.trials);
    const kept = entry.trials.filter((trial) => trial.forward === trial.reverse);
    const after = compare(kept);
    assert.equal(after.winner, before.winner, `${entry.id}: a discarded trial was deciding the result`);
    assert.equal(after.a, before.a, entry.id);
    assert.equal(after.b, before.b, entry.id);
  }
});
