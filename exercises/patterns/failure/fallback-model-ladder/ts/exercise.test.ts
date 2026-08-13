import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Answer, Rung, ask as Ask } from './start.ts';

interface Case {
  id: string;
  outcomes: string[];
  result: Answer;
}

const fixture = expected<{ chapter: string; ladder: Rung[]; cases: Case[] }>(import.meta.url);
const { ask } = await loadImpl<{ ask: typeof Ask }>(import.meta.url);

const run = (entry: Case) => ask(fixture.ladder, entry.outcomes);

const cases: Array<[string, string]> = [
  ['the-first-model-answers', 'the preferred model is tried first'],
  ['an-outage-falls-through-to-the-next-model', 'capacity trouble descends the ladder'],
  ['the-ladder-descends-until-something-answers', 'the descent continues while it can'],
  ['a-refusal-stops-the-ladder', 'a refusal is an answer, not a failure'],
  ['a-refusal-lower-down-also-stops-the-ladder', 'that holds anywhere on the ladder'],
  ['every-model-failing-exhausts-the-ladder', 'running out of models is its own outcome'],
  ['failed-attempts-still-cost-money', 'the failed call was billed'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('the ladder is walked from the top, in order, without skipping', () => {
  for (const entry of fixture.cases) {
    const { tried } = run(entry);
    assert.deepEqual(
      tried,
      fixture.ladder.slice(0, tried.length).map((rung) => rung.model),
      `${entry.id}: the ladder was walked out of order`,
    );
  }
});

test('spent is the cost of every model tried', () => {
  for (const entry of fixture.cases) {
    const { tried, spent } = run(entry);
    const billed = tried.reduce(
      (sum, model) => sum + fixture.ladder.find((rung) => rung.model === model)!.cost,
      0,
    );
    assert.equal(spent, billed, `${entry.id}: cost accounting missed a failed call`);
  }
});

test('a refusal never descends to another model', () => {
  for (const entry of fixture.cases) {
    const { status, tried } = run(entry);
    if (status !== 'refused') continue;
    assert.equal(
      entry.outcomes[tried.length - 1],
      'refused',
      `${entry.id}: reported a refusal from a model that did not refuse`,
    );
  }
});

test('only an exhausted ladder reports no answering model', () => {
  for (const entry of fixture.cases) {
    const { status, answeredBy } = run(entry);
    if (status === 'exhausted') assert.equal(answeredBy, null, `${entry.id}`);
    else assert.ok(answeredBy, `${entry.id}: ${status} without a model`);
  }
});
