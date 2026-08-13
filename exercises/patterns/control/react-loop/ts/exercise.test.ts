import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { ScriptStep, Trace, react as React } from './start.ts';

interface Case {
  id: string;
  maxSteps: number;
  script: ScriptStep[];
  result: Trace;
}

const fixture = expected<{
  chapter: string;
  observations: Record<string, string>;
  cases: Case[];
}>(import.meta.url);
const { react } = await loadImpl<{ react: typeof React }>(import.meta.url);

const run = (entry: Case) => react(entry.script, fixture.observations, entry.maxSteps);

const cases: Array<[string, string]> = [
  ['answers-on-the-first-thought', 'a run can answer without acting'],
  ['one-action-then-an-answer', 'the observation lands before the next thought'],
  ['an-unknown-action-observes-an-error-and-continues', 'a failed action is observed, not thrown'],
  ['a-model-that-never-answers-is-bounded', 'the budget stops an endless loop'],
  ['the-bound-cuts-before-the-answering-step', 'the bound is checked before the step, not after'],
  ['an-empty-script-is-bounded-immediately', 'nothing to do is bounded, not answered'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('every action in the transcript carries its observation', () => {
  for (const entry of fixture.cases) {
    for (const step of run(entry).transcript) {
      if (step.action === undefined) continue;
      assert.ok(
        typeof step.observation === 'string' && step.observation.length > 0,
        `${entry.id}: action ${step.action} has no observation`,
      );
    }
  }
});

test('a bounded run reports no answer, an answered run reports one', () => {
  for (const entry of fixture.cases) {
    const { status, answer } = run(entry);
    if (status === 'bounded') assert.equal(answer, null, `${entry.id}: bounded with an answer`);
    else assert.notEqual(answer, null, `${entry.id}: answered with nothing`);
  }
});

test('the transcript never exceeds the bound', () => {
  for (const entry of fixture.cases) {
    assert.ok(run(entry).transcript.length <= entry.maxSteps, `${entry.id}: over the bound`);
  }
});
