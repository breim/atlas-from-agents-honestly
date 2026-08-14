import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Budget, Executed, Plan, execute as Execute } from './start.ts';

interface Case {
  id: string;
  plan: Plan;
  budget: Budget;
  result: Executed;
}

const fixture = expected<{ chapter: string; cases: Case[] }>(import.meta.url);
const { execute } = await loadImpl<{ execute: typeof Execute }>(import.meta.url);

const run = (entry: Case, plan = entry.plan, budget = entry.budget) => execute(plan, budget);
const ORDER = ['overlapping_inputs', 'workers_talked', 'verified_against_conclusions', 'no_termination_owner'];

const cases: Array<[string, string]> = [
  ['a-supervisor-fans-out-and-owns-the-ending', 'one owner, one spine'],
  ['a-verifier-reading-conclusions-is-a-second-vote', 'a check reads the sources'],
  ['overlapping-inputs-are-not-disjoint', 'two workers, one document'],
  ['workers-that-talk-have-bought-a-handoff-inside-a-supervisor', 'paid for, gained nothing'],
  ['a-handoff-chain-compresses-at-every-hop', 'three summaries from the customer'],
  ['nobody-owns-done-so-the-budget-does', 'the hot potato, with a name'],
  ['a-supervisor-that-does-not-fit-stops-cleanly', 'a partial result, not a loop'],
  ['a-chain-that-ends-with-nobody-drops-the-ticket', 'the other half of ambiguous ownership'],
  ['a-one-agent-handoff-is-just-an-agent', 'no transfer, no tax'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('a supervisor keeps every worker at the sources', () => {
  for (const entry of fixture.cases) {
    if (entry.plan.topology !== 'supervisor') continue;
    for (const step of run(entry).steps) {
      if (step.agent === 'synthesize') continue;
      assert.equal(step.compressionDepth, 1, `${entry.id}: ${step.agent} read a summary`);
    }
  }
});

test('a handoff compresses by exactly one at every transfer', () => {
  for (const entry of fixture.cases) {
    if (entry.plan.topology !== 'handoff') continue;
    run(entry).steps.forEach((step, index) => {
      assert.equal(step.compressionDepth, index + 1, `${entry.id}: hop ${index} lost count`);
    });
  }
});

test('a supervisor always has a termination owner', () => {
  for (const entry of fixture.cases) {
    if (entry.plan.topology !== 'supervisor') continue;
    const { outcome, terminatedBy } = run(entry);
    assert.equal(terminatedBy, outcome === 'completed' ? 'supervisor' : 'budget', entry.id);
  }
});

test('a handoff with nobody declaring done never completes', () => {
  for (const entry of fixture.cases) {
    if (entry.plan.topology !== 'handoff') continue;
    const orphaned = entry.plan.agents.map((agent) => ({ ...agent, declaresDone: false }));
    const result = run(entry, { ...entry.plan, agents: orphaned });
    assert.notEqual(result.outcome, 'completed', `${entry.id}: something ended it`);
    assert.ok(['budget', 'nobody'].includes(result.terminatedBy), `${entry.id}: ${result.terminatedBy}`);
    assert.ok(result.violations.includes('no_termination_owner'), `${entry.id}: nobody owns done`);
  }
});

test('a chain that runs out of agents drops the work rather than looping', () => {
  for (const entry of fixture.cases) {
    const { outcome, terminatedBy, steps } = run(entry);
    if (outcome !== 'dropped') continue;
    const last = entry.plan.agents.find((agent) => agent.name === steps[steps.length - 1].agent)!;
    assert.equal(last.next, null, `${entry.id}: it had somewhere to go`);
    assert.equal(last.declaresDone, false, `${entry.id}: it had claimed the work`);
    assert.equal(terminatedBy, 'nobody', entry.id);
  }
});

test('somebody declaring done removes the violation and shortens the run', () => {
  for (const entry of fixture.cases) {
    if (entry.plan.topology !== 'handoff') continue;
    const before = run(entry);
    const owned = entry.plan.agents.map((agent) =>
      agent.name === entry.plan.start ? { ...agent, declaresDone: true } : agent,
    );
    const after = run(entry, { ...entry.plan, agents: owned });
    assert.ok(!after.violations.includes('no_termination_owner'), entry.id);
    assert.ok(after.steps.length <= before.steps.length, `${entry.id}: declaring done cost steps`);
  }
});

test('nothing ever runs past the budget', () => {
  for (const entry of fixture.cases) {
    for (const maxSteps of [0, 1, 3, entry.budget.maxSteps, 100]) {
      const result = run(entry, entry.plan, { maxSteps });
      assert.ok(result.steps.length <= maxSteps, `${entry.id}: ${maxSteps} was exceeded`);
      assert.equal(result.outcome === 'budget_exhausted', result.terminatedBy === 'budget', entry.id);
      assert.equal(result.outcome === 'dropped', result.terminatedBy === 'nobody', entry.id);
    }
  }
});

test('a bigger budget never produces fewer steps', () => {
  for (const entry of fixture.cases) {
    const before = run(entry).steps.length;
    const richer = run(entry, entry.plan, { maxSteps: entry.budget.maxSteps + 5 });
    assert.ok(richer.steps.length >= before, `${entry.id}: more room did less work`);
  }
});

test('verifying against sources never adds a compression', () => {
  for (const entry of fixture.cases) {
    if (entry.plan.topology !== 'supervisor') continue;
    const grounded = run(entry, { ...entry.plan, verifiesAgainst: 'sources' });
    const hearsay = run(entry, { ...entry.plan, verifiesAgainst: 'conclusions' });
    const depthOf = (result: Executed) => result.steps.find((step) => step.agent === 'synthesize')?.compressionDepth;
    if (depthOf(grounded) === undefined) continue;
    assert.ok(depthOf(grounded)! < depthOf(hearsay)!, `${entry.id}: reading sources cost a hop`);
    assert.ok(!grounded.violations.includes('verified_against_conclusions'), entry.id);
    assert.ok(hearsay.violations.includes('verified_against_conclusions'), entry.id);
  }
});

test('violations are reported in a fixed order, without repeats', () => {
  for (const entry of fixture.cases) {
    const { violations } = run(entry);
    assert.deepEqual(violations, ORDER.filter((name) => violations.includes(name)), entry.id);
    assert.equal(new Set(violations).size, violations.length, entry.id);
  }
});

test('a handoff never reports a supervisor violation, and the reverse', () => {
  for (const entry of fixture.cases) {
    const { violations } = run(entry);
    const supervisorOnly = ['overlapping_inputs', 'workers_talked', 'verified_against_conclusions'];
    for (const name of violations) {
      const owned = entry.plan.topology === 'supervisor' ? supervisorOnly : ['no_termination_owner'];
      assert.ok(owned.includes(name), `${entry.id}: ${name} belongs to the other topology`);
    }
  }
});
