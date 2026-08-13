import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { SagaResult, runSaga as RunSaga } from './start.ts';

interface Case {
  id: string;
  steps: string[];
  failAt: string | null;
  result: SagaResult;
}

const fixture = expected<{ chapter: string; cases: Case[] }>(import.meta.url);
const { runSaga } = await loadImpl<{ runSaga: typeof RunSaga }>(import.meta.url);

const run = (entry: Case) => runSaga(entry.steps, entry.failAt);

const cases: Array<[string, string]> = [
  ['every-step-succeeds-and-nothing-compensates', 'a clean run undoes nothing'],
  ['a-failure-compensates-in-reverse-order', 'cleanup unwinds the way it wound up'],
  ['the-failing-step-is-not-compensated', 'an effect that never happened is not undone'],
  ['failing-on-the-first-step-compensates-nothing', 'nothing completed means nothing to undo'],
  ['steps-after-the-failure-never-run', 'a failed saga does not keep going'],
  ['a-single-step-saga-succeeds', 'one step is still a saga'],
  ['an-empty-saga-succeeds-trivially', 'an empty saga is a success'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('compensation is exactly the completed steps, reversed', () => {
  for (const entry of fixture.cases) {
    const { ok, completed, compensated } = run(entry);
    assert.deepEqual(
      compensated,
      ok ? [] : [...completed].reverse(),
      `${entry.id}: compensation does not mirror what completed`,
    );
  }
});

test('the failing step never appears as completed or compensated', () => {
  for (const entry of fixture.cases) {
    if (entry.failAt === null) continue;
    const { completed, compensated } = run(entry);
    assert.ok(!completed.includes(entry.failAt), `${entry.id}: counted the failure as completed`);
    assert.ok(!compensated.includes(entry.failAt), `${entry.id}: compensated a step that never ran`);
  }
});

test('completed steps are a prefix of the declared steps', () => {
  for (const entry of fixture.cases) {
    const { completed } = run(entry);
    assert.deepEqual(
      completed,
      entry.steps.slice(0, completed.length),
      `${entry.id}: steps ran out of order`,
    );
  }
});
