import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Outcome, Step, run as Run } from './start.ts';

interface Case {
  id: string;
  plan: Step[];
  result: Outcome;
}

const fixture = expected<{ chapter: string; tools: string[]; cases: Case[] }>(import.meta.url);
const { run } = await loadImpl<{ run: typeof Run }>(import.meta.url);

const execute = (entry: Case) => run(entry.plan, fixture.tools);

const cases: Array<[string, string]> = [
  ['a-valid-plan-runs-in-order', 'a dependency chain runs front to back'],
  ['independent-steps-keep-declaration-order', 'independence does not license reordering'],
  ['an-unknown-tool-rejects-the-whole-plan', 'a bad step two prevents step one from running'],
  ['a-dependency-on-a-missing-step-rejects-the-plan', 'a dependency on nothing is caught'],
  ['a-forward-dependency-rejects-the-plan', 'a step cannot depend on a later step'],
  ['a-duplicate-step-id-rejects-the-plan', 'two steps cannot share an id'],
  ['a-self-dependency-rejects-the-plan', 'a step cannot depend on itself'],
  ['an-empty-plan-succeeds-having-done-nothing', 'an empty plan is valid and does nothing'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(execute(entry), entry.result);
  });
}

test('a rejected plan executes nothing at all', () => {
  for (const entry of fixture.cases) {
    const outcome = execute(entry);
    if (outcome.ok) continue;
    assert.deepEqual(outcome.executed, [], `${entry.id}: ran ${outcome.executed.length} step(s)`);
  }
});

test('an accepted plan executes every step exactly once', () => {
  for (const entry of fixture.cases) {
    const outcome = execute(entry);
    if (!outcome.ok) continue;
    assert.deepEqual(
      outcome.executed,
      entry.plan.map((step) => step.id),
      `${entry.id}: executed set does not match the plan`,
    );
  }
});

test('every dependency ran before the step that needed it', () => {
  for (const entry of fixture.cases) {
    const outcome = execute(entry);
    if (!outcome.ok) continue;
    for (const step of entry.plan) {
      for (const need of step.needs) {
        assert.ok(
          outcome.executed.indexOf(need) < outcome.executed.indexOf(step.id),
          `${entry.id}: ${step.id} ran before its dependency ${need}`,
        );
      }
    }
  }
});
