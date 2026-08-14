import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Signals, Verdict, classify as Classify } from './start.ts';

interface Case {
  id: string;
  signals: Signals;
  verdict: Verdict;
}

const fixture = expected<{ chapter: string; cases: Case[] }>(import.meta.url);
const { classify } = await loadImpl<{ classify: typeof Classify }>(import.meta.url);

const cases: Array<[string, string]> = [
  ['fully-deterministic-work-is-a-workflow', 'known work is a workflow'],
  ['needing-a-model-does-not-make-it-an-agent', 'a model step is still a workflow'],
  ['unknown-steps-make-it-an-agent', 'not knowing the steps is the trigger'],
  ['unenumerable-branches-make-it-an-agent', 'so is not knowing the branches'],
  ['unknown-structure-outranks-the-judgement-question', 'structure decides first'],
  ['knowing-nothing-is-an-agent', 'nothing known is an agent'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.equal(classify(entry.signals), entry.verdict);
  });
}

test('judgement alone never turns a workflow into an agent', () => {
  for (const entry of fixture.cases) {
    const withModel = classify({ ...entry.signals, needsJudgement: true });
    const without = classify({ ...entry.signals, needsJudgement: false });
    const bothAgents = withModel === 'agent' && without === 'agent';
    const bothWorkflows = withModel !== 'agent' && without !== 'agent';
    assert.ok(bothAgents || bothWorkflows, `${entry.id}: judgement changed the shape`);
  }
});

test('every combination of signals is classified', () => {
  for (const stepsKnownUpfront of [true, false]) {
    for (const branchesEnumerable of [true, false]) {
      for (const needsJudgement of [true, false]) {
        const verdict = classify({ stepsKnownUpfront, branchesEnumerable, needsJudgement });
        assert.ok(
          ['workflow', 'workflow-with-model-steps', 'agent'].includes(verdict),
          `${stepsKnownUpfront}/${branchesEnumerable}/${needsJudgement} produced ${verdict}`,
        );
      }
    }
  }
});

test('losing structural knowledge never moves work away from being an agent', () => {
  for (const entry of fixture.cases) {
    if (classify(entry.signals) !== 'agent') continue;
    for (const key of ['stepsKnownUpfront', 'branchesEnumerable'] as const) {
      assert.equal(
        classify({ ...entry.signals, [key]: false }),
        'agent',
        `${entry.id}: knowing less made it stop being an agent`,
      );
    }
  }
});

test('a workflow with model steps only differs from a workflow by judgement', () => {
  for (const entry of fixture.cases) {
    if (classify(entry.signals) !== 'workflow-with-model-steps') continue;
    assert.equal(
      classify({ ...entry.signals, needsJudgement: false }),
      'workflow',
      `${entry.id}: removing judgement did not leave a plain workflow`,
    );
  }
});
