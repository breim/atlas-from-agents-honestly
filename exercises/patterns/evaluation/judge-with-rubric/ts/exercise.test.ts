import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Criterion, Verdict, judge as Judge } from './start.ts';

interface Case {
  id: string;
  scores: Record<string, number>;
  result: Verdict;
}

const fixture = expected<{
  chapter: string;
  rubric: Criterion[];
  threshold: number;
  cases: Case[];
}>(import.meta.url);
const { judge } = await loadImpl<{ judge: typeof Judge }>(import.meta.url);

const run = (entry: Case) => judge(entry.scores, fixture.rubric, fixture.threshold);

const cases: Array<[string, string]> = [
  ['a-strong-answer-passes', 'a good answer clears the bar'],
  ['an-unaddressed-criterion-scores-zero', 'the denominator is the rubric, not the scores'],
  ['a-veto-beats-a-high-total', 'some criteria are gates, not contributions'],
  ['exactly-at-the-minimum-passes', 'the minimum is inclusive'],
  ['exactly-at-the-threshold-passes', 'the threshold is inclusive too'],
  ['a-perfect-score-on-the-lightest-criterion-does-not-rescue', 'weights mean what they say'],
  ['a-score-for-a-criterion-not-in-the-rubric-is-ignored', 'the judge cannot invent criteria'],
  ['nothing-scored-fails-everything', 'an empty judgement is not a pass'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('every rubric criterion is accounted for, scored or not', () => {
  for (const entry of fixture.cases) {
    const { unaddressed } = run(entry);
    const missing = fixture.rubric
      .filter((criterion) => !(criterion.criterion in entry.scores))
      .map((criterion) => criterion.criterion);
    assert.deepEqual(unaddressed, missing, `${entry.id}: unaddressed does not match the rubric`);
  }
});

test('a veto always fails the verdict', () => {
  for (const entry of fixture.cases) {
    const { vetoed, verdict } = run(entry);
    if (vetoed.length === 0) continue;
    assert.equal(verdict, 'fail', `${entry.id}: passed despite ${vetoed.join(', ')}`);
  }
});

test('the total is the weighted mean over the whole rubric', () => {
  for (const entry of fixture.cases) {
    const weighted = fixture.rubric.reduce(
      (sum, c) => sum + (entry.scores[c.criterion] ?? 0) * c.weight,
      0,
    );
    const weights = fixture.rubric.reduce((sum, c) => sum + c.weight, 0);
    assert.equal(
      run(entry).total,
      Math.floor(weighted / weights + 0.5),
      `${entry.id}: the total does not match the rubric`,
    );
  }
});

test('dropping a score never raises the total', () => {
  for (const entry of fixture.cases) {
    const before = run(entry).total;
    for (const key of Object.keys(entry.scores)) {
      const fewer = { ...entry.scores };
      delete fewer[key];
      assert.ok(
        judge(fewer, fixture.rubric, fixture.threshold).total <= before,
        `${entry.id}: dropping ${key} improved the score`,
      );
    }
  }
});
