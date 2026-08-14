import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Call, Spec, Trajectory, score as Score } from './start.ts';

interface Case {
  id: string;
  spec: Spec;
  calls: Call[];
  result: Trajectory;
}

const fixture = expected<{ chapter: string; cases: Case[] }>(import.meta.url);
const { score } = await loadImpl<{ score: typeof Score }>(import.meta.url);

const run = (entry: Case, calls = entry.calls) => score(calls, entry.spec);
const tools = (calls: Call[]) => new Set(calls.map((call) => call.tool));

const cases: Array<[string, string]> = [
  ['a-clean-run-scores-everything', 'the run that worked'],
  ['a-missing-lookup-is-a-recall-failure', 'a confident answer from incomplete data'],
  ['an-unnecessary-call-is-a-precision-failure', 'context rented for the rest of the run'],
  ['seven-steps-where-three-would-do', 'right answer, wasteful path'],
  ['retrying-the-same-bad-call-is-a-loop', 'the error text selected no branch'],
  ['fixing-the-argument-the-error-named-is-not-a-loop', 'that is recovery, not repetition'],
  ['refunding-before-verifying-is-a-policy-violation', 'the effect preceded the decision'],
  ['the-same-two-calls-in-the-policy-order-are-fine', 'order as policy, satisfied'],
  ['an-effect-with-no-decision-at-all-is-a-violation', 'a missing gate is not a late gate'],
  ['order-that-is-not-policy-is-not-scored', 'the model chooses the sequence'],
  ['a-run-that-called-nothing-scores-no-recall', 'nothing looked up, nothing known'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('recall is full exactly when every required tool was called', () => {
  for (const entry of fixture.cases) {
    const complete = entry.spec.required.every((tool) => tools(entry.calls).has(tool));
    assert.equal(run(entry).recallBps === 10000, complete, `${entry.id}: recall disagrees with the spec`);
  }
});

test('precision is full exactly when nothing unrequired was called', () => {
  for (const entry of fixture.cases) {
    const lean = [...tools(entry.calls)].every((tool) => entry.spec.required.includes(tool));
    assert.equal(run(entry).precisionBps === 10000, lean, `${entry.id}: precision disagrees with the spec`);
  }
});

test('one more unnecessary call never raises precision or lowers recall', () => {
  for (const entry of fixture.cases) {
    const before = run(entry);
    const extra: Call = { tool: 'unrelated_tool', args: 'x', error: null, contributed: false };
    const after = run(entry, [...entry.calls, extra]);
    assert.ok(after.precisionBps <= before.precisionBps, `${entry.id}: waste improved precision`);
    assert.ok(after.recallBps >= before.recallBps, `${entry.id}: waste cost recall`);
  }
});

test('dropping a required call never raises recall', () => {
  for (const entry of fixture.cases) {
    for (const tool of entry.spec.required) {
      const without = entry.calls.filter((call) => call.tool !== tool);
      assert.ok(run(entry, without).recallBps <= run(entry).recallBps, `${entry.id}: losing ${tool} helped`);
    }
  }
});

test('step efficiency never claims more than a hundred percent', () => {
  for (const entry of fixture.cases) {
    const { stepEfficiencyBps } = run(entry);
    assert.ok(stepEfficiencyBps <= 10000 && stepEfficiencyBps >= 0, `${entry.id}: ${stepEfficiencyBps}`);
  }
});

test('redundancy is the share of calls that contributed nothing', () => {
  for (const entry of fixture.cases) {
    const wasted = entry.calls.filter((call) => !call.contributed).length;
    const share = entry.calls.length === 0 ? 0 : Math.floor((wasted * 10000) / entry.calls.length + 0.5);
    assert.equal(run(entry).redundantBps, share, `${entry.id}: the waste does not add up`);
  }
});

test('loop escape is full exactly when no failing call was repeated identically', () => {
  for (const entry of fixture.cases) {
    const seen = new Set<string>();
    let repeated = false;
    for (const call of entry.calls) {
      const key = `${call.tool} ${call.args} ${call.error}`;
      if (call.error !== null && seen.has(key)) repeated = true;
      seen.add(key);
    }
    assert.equal(run(entry).loopEscapeBps === 10000, !repeated, `${entry.id}: loop escape disagrees`);
  }
});

test('changing the argument on every retry escapes the loop', () => {
  for (const entry of fixture.cases) {
    const tuned = entry.calls.map((call, index) => ({ ...call, args: `${call.args}-${index}` }));
    assert.equal(run(entry, tuned).loopEscapeBps, 10000, `${entry.id}: distinct calls read as a loop`);
  }
});

test('a policy pair is violated exactly when the effect has no decision before it', () => {
  for (const entry of fixture.cases) {
    const { policyViolations } = run(entry);
    for (const [before, after] of entry.spec.orderPolicy) {
      const decision = entry.calls.findIndex((call) => call.tool === before);
      const effect = entry.calls.findIndex((call) => call.tool === after);
      const broken = effect !== -1 && (decision === -1 || decision > effect);
      assert.equal(policyViolations.includes(`${before}->${after}`), broken, entry.id);
    }
  }
});

test('reordering calls no policy names changes nothing that is scored', () => {
  for (const entry of fixture.cases) {
    if (entry.spec.orderPolicy.length > 0) continue;
    const before = run(entry);
    const after = run(entry, [...entry.calls].reverse());
    assert.equal(after.recallBps, before.recallBps, `${entry.id}: recall depended on the order`);
    assert.equal(after.precisionBps, before.precisionBps, `${entry.id}: precision depended on the order`);
    assert.equal(after.stepEfficiencyBps, before.stepEfficiencyBps, entry.id);
    assert.deepEqual(after.policyViolations, [], `${entry.id}: an unstated order was enforced`);
  }
});
