import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Outcome, Round, optimise as Optimise } from './start.ts';

interface Case {
  id: string;
  rounds: Round[];
  result: Outcome;
}

const fixture = expected<{
  chapter: string;
  threshold: number;
  maxRounds: number;
  cases: Case[];
}>(import.meta.url);
const { optimise } = await loadImpl<{ optimise: typeof Optimise }>(import.meta.url);

const run = (entry: Case) => optimise(entry.rounds, fixture.threshold, fixture.maxRounds);

const cases: Array<[string, string]> = [
  ['a-first-draft-over-the-bar-converges-immediately', 'a good first draft ends the loop'],
  ['the-threshold-is-inclusive', 'exactly at the bar has converged'],
  ['feedback-drives-the-loop-until-it-converges', 'acting on feedback reaches the bar'],
  ['repeated-feedback-stalls-the-loop', 'an evaluator repeating itself ends the loop'],
  ['a-stall-returns-the-best-draft-not-the-last', 'a stall still returns the best work'],
  ['alternating-feedback-does-not-count-as-a-stall', 'a zigzag is still movement'],
  ['running-out-of-rounds-returns-the-best-so-far', 'the budget cuts before a later win'],
  ['ties-keep-the-earlier-draft', 'an equal score does not displace the incumbent'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('the returned draft is the best one actually reached', () => {
  for (const entry of fixture.cases) {
    const { rounds, score } = run(entry);
    const reached = entry.rounds.slice(0, rounds);
    assert.equal(score, Math.max(...reached.map((round) => round.score)), entry.id);
  }
});

test('rounds consumed never exceeds the budget or the script', () => {
  for (const entry of fixture.cases) {
    const { rounds } = run(entry);
    assert.ok(rounds <= fixture.maxRounds, `${entry.id}: over budget`);
    assert.ok(rounds <= entry.rounds.length, `${entry.id}: consumed rounds that did not exist`);
  }
});

test('converging means the bar was actually cleared', () => {
  for (const entry of fixture.cases) {
    const { stopped, rounds } = run(entry);
    if (stopped !== 'converged') continue;
    assert.ok(
      entry.rounds[rounds - 1].score >= fixture.threshold,
      `${entry.id}: claimed convergence without reaching the bar`,
    );
  }
});

test('stalling means the evaluator really did repeat itself', () => {
  for (const entry of fixture.cases) {
    const { stopped, rounds } = run(entry);
    if (stopped !== 'stalled') continue;
    assert.equal(
      entry.rounds[rounds - 1].feedback,
      entry.rounds[rounds - 2].feedback,
      `${entry.id}: stalled on feedback that had changed`,
    );
  }
});

test('nothing after the stop is ever consumed', () => {
  for (const entry of fixture.cases) {
    const { rounds } = run(entry);
    assert.deepEqual(
      optimise(entry.rounds.slice(0, rounds), fixture.threshold, fixture.maxRounds),
      run(entry),
      `${entry.id}: rounds past the stop affected the result`,
    );
  }
});
