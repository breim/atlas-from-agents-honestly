import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Action, Budget, Enforcement, enforce as Enforce } from './start.ts';

interface Case {
  id: string;
  actions: Action[];
  result: Enforcement;
}

const fixture = expected<{ chapter: string; budget: Budget; cases: Case[] }>(import.meta.url);
const { enforce } = await loadImpl<{ enforce: typeof Enforce }>(import.meta.url);

const run = (entry: Case) => enforce(entry.actions, fixture.budget);

const cases: Array<[string, string]> = [
  ['an-action-inside-every-bound-is-allowed', 'a legitimate action goes through'],
  ['the-action-count-is-capped', 'the agent stops after its allotted actions'],
  ['spend-accumulates-across-actions', 'two affordable actions can be unaffordable together'],
  ['spending-exactly-the-budget-is-allowed', 'the last cent is spendable'],
  ['a-tool-outside-the-grant-is-denied', 'an ungranted tool never runs'],
  ['a-denial-consumes-no-budget', 'a refusal does not starve the rest of the run'],
  ['scope-is-checked-before-spend', 'the reason code names the real problem'],
  ['no-actions-consume-nothing', 'an empty run is an empty result'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('every action is either allowed or denied, exactly once', () => {
  for (const entry of fixture.cases) {
    const { allowed, denied } = run(entry);
    assert.equal(
      allowed.length + denied.length,
      entry.actions.length,
      `${entry.id}: an action was lost or counted twice`,
    );
  }
});

test('no ungranted tool is ever allowed', () => {
  for (const entry of fixture.cases) {
    for (const tool of run(entry).allowed) {
      assert.ok(fixture.budget.tools.includes(tool), `${entry.id}: allowed ungranted ${tool}`);
    }
  }
});

test('neither bound is ever exceeded', () => {
  for (const entry of fixture.cases) {
    const { allowed } = run(entry);
    assert.ok(allowed.length <= fixture.budget.actions, `${entry.id}: over the action budget`);

    const remaining = [...entry.actions];
    const spent = allowed.reduce((sum, tool) => {
      const index = remaining.findIndex((action) => action.tool === tool);
      return sum + remaining.splice(index, 1)[0].cents;
    }, 0);
    assert.ok(spent <= fixture.budget.cents, `${entry.id}: spent ${spent} over the budget`);
  }
});
