import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Cascade, Rung, cascade as CascadeFn } from './start.ts';

interface Case {
  id: string;
  confidences: number[];
  result: Cascade;
}

const fixture = expected<{
  chapter: string;
  ladder: Rung[];
  threshold: number;
  cases: Case[];
}>(import.meta.url);
const { cascade } = await loadImpl<{ cascade: typeof CascadeFn }>(import.meta.url);

const run = (entry: Case) => cascade(fixture.ladder, entry.confidences, fixture.threshold);

const cases: Array<[string, string]> = [
  ['a-confident-cheap-answer-stops-the-cascade', 'the cheap model answers when it is sure'],
  ['the-threshold-is-inclusive', 'exactly at the bar is confident enough'],
  ['low-confidence-escalates-one-rung', 'an unsure answer buys the next model'],
  ['the-cascade-climbs-until-something-is-confident', 'the climb continues while it can'],
  ['the-top-rung-is-accepted-however-unsure-it-is', 'no answer is not better than an unsure one'],
  ['escalating-all-the-way-costs-more-than-going-straight-to-the-top', 'a cascade is a bet, and it can lose'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('the ladder is walked cheapest-first without skipping', () => {
  for (const entry of fixture.cases) {
    const { tried } = run(entry);
    assert.deepEqual(
      tried,
      fixture.ladder.slice(0, tried.length).map((rung) => rung.model),
      `${entry.id}: skipped a rung`,
    );
  }
});

test('spent is the cost of every model called, not just the one that answered', () => {
  for (const entry of fixture.cases) {
    const { tried, spent } = run(entry);
    const billed = tried.reduce(
      (sum, model) => sum + fixture.ladder.find((rung) => rung.model === model)!.cost,
      0,
    );
    assert.equal(spent, billed, `${entry.id}: the cheap attempts were not billed`);
  }
});

test('a cascade only stops early on a confident answer', () => {
  for (const entry of fixture.cases) {
    const { tried } = run(entry);
    const stoppedEarly = tried.length < fixture.ladder.length;
    if (!stoppedEarly) continue;
    assert.ok(
      entry.confidences[tried.length - 1] >= fixture.threshold,
      `${entry.id}: stopped on an unconfident answer with rungs left`,
    );
  }
});

test('escalated agrees with how many models were called', () => {
  for (const entry of fixture.cases) {
    const { escalated, tried } = run(entry);
    assert.equal(escalated, tried.length > 1, `${entry.id}: escalated disagrees with tried`);
  }
});
