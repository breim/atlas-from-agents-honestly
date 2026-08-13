import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Outcome, Round, reflect as Reflect } from './start.ts';

interface Case {
  id: string;
  maxRounds: number;
  rounds: Round[];
  result: Outcome;
}

const fixture = expected<{ chapter: string; threshold: number; cases: Case[] }>(import.meta.url);
const { reflect } = await loadImpl<{ reflect: typeof Reflect }>(import.meta.url);

const run = (entry: Case) => reflect(entry.rounds, fixture.threshold, entry.maxRounds);

const cases: Array<[string, string]> = [
  ['a-first-draft-good-enough-stops-immediately', 'a good first draft is not revised'],
  ['improves-until-it-clears-the-threshold', 'reflection stops the round it clears the bar'],
  ['the-threshold-is-inclusive', 'exactly at the threshold is good enough'],
  ['runs-out-of-rounds-and-returns-the-best', 'the budget ends the loop, the best draft wins'],
  ['revision-that-makes-things-worse-does-not-win', 'a worse revision is not shipped'],
  ['ties-keep-the-earlier-draft', 'an equal score does not displace the incumbent'],
  ['the-budget-cuts-the-run-short', 'a round beyond the budget never happens'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('the returned draft is the best one that was actually reached', () => {
  for (const entry of fixture.cases) {
    const outcome = run(entry);
    const reached = entry.rounds.slice(0, outcome.rounds);
    assert.equal(
      outcome.score,
      Math.max(...reached.map((round) => round.score)),
      `${entry.id}: returned a draft that was not the best seen`,
    );
  }
});

test('rounds consumed never exceeds the budget or the script', () => {
  for (const entry of fixture.cases) {
    const { rounds } = run(entry);
    assert.ok(rounds <= entry.maxRounds, `${entry.id}: over budget`);
    assert.ok(rounds <= entry.rounds.length, `${entry.id}: consumed rounds that did not exist`);
  }
});

test('stopping on the threshold means the bar was actually cleared', () => {
  for (const entry of fixture.cases) {
    const outcome = run(entry);
    if (outcome.stopped !== 'threshold') continue;
    assert.ok(
      entry.rounds[outcome.rounds - 1].score >= fixture.threshold,
      `${entry.id}: claimed the threshold without reaching it`,
    );
  }
});
