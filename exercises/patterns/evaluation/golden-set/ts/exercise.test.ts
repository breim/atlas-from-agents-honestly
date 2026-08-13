import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { GoldenCase, Score, score as ScoreFn } from './start.ts';

interface Case {
  id: string;
  answers: Record<string, string>;
  result: Score;
}

const fixture = expected<{ chapter: string; golden: GoldenCase[]; cases: Case[] }>(
  import.meta.url,
);
const { score } = await loadImpl<{ score: typeof ScoreFn }>(import.meta.url);

const run = (entry: Case) => score(fixture.golden, entry.answers);

const cases: Array<[string, string]> = [
  ['a-perfect-run-passes-everything', 'a correct run scores one'],
  ['a-wrong-answer-fails-its-case', 'a wrong answer is a failure'],
  ['an-unanswered-case-is-a-failure-not-an-omission', 'the denominator is the golden set'],
  ['an-answer-to-a-case-that-is-not-in-the-set-is-ignored', 'extra answers do not inflate the score'],
  ['matching-is-exact-not-fuzzy', 'casing and whitespace are not normalised away'],
  ['answering-nothing-fails-everything', 'a broken harness scores zero, not one'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('every golden case is judged exactly once', () => {
  for (const entry of fixture.cases) {
    const { passed, failed } = run(entry);
    assert.deepEqual(
      [...passed, ...failed].sort(),
      fixture.golden.map((entry) => entry.id).sort(),
      `${entry.id}: the suite silently shrank`,
    );
  }
});

test('the rate is always passed over the size of the golden set', () => {
  for (const entry of fixture.cases) {
    const { passed, rate } = run(entry);
    assert.equal(
      rate,
      Math.floor((passed.length / fixture.golden.length) * 10000 + 0.5) / 10000,
      `${entry.id}: the rate does not match the golden set`,
    );
  }
});

test('every missing case is also a failure', () => {
  for (const entry of fixture.cases) {
    const { missing, failed } = run(entry);
    for (const id of missing) {
      assert.ok(failed.includes(id), `${entry.id}: ${id} went missing without failing`);
    }
  }
});

test('dropping an answer never raises the rate', () => {
  for (const entry of fixture.cases) {
    const before = run(entry).rate;
    for (const key of Object.keys(entry.answers)) {
      const fewer = { ...entry.answers };
      delete fewer[key];
      assert.ok(
        score(fixture.golden, fewer).rate <= before,
        `${entry.id}: dropping ${key} improved the score`,
      );
    }
  }
});
