import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Call, Enforcement, enforce as Enforce } from './start.ts';

interface Case {
  id: string;
  calls: Call[];
  result: Enforcement;
}

const fixture = expected<{ chapter: string; budget: number; cases: Case[] }>(import.meta.url);
const { enforce } = await loadImpl<{ enforce: typeof Enforce }>(import.meta.url);

const run = (entry: Case) => enforce(entry.calls, fixture.budget);

const cases: Array<[string, string]> = [
  ['calls-inside-the-budget-all-run', 'affordable work goes through'],
  ['spending-exactly-the-budget-is-allowed', 'the last token is spendable'],
  ['one-token-over-is-refused', 'the ceiling is a ceiling'],
  ['a-call-is-refused-whole-never-truncated', 'a call is not trimmed to fit'],
  ['a-refusal-consumes-nothing-and-the-run-continues', 'a later smaller call still fits'],
  ['a-call-larger-than-the-whole-budget-can-never-run', 'no budget would have helped'],
  ['a-zero-token-call-always-fits', 'a free call is free even at the ceiling'],
  ['no-calls-spend-nothing', 'an empty run spends nothing'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('the budget is never exceeded', () => {
  for (const entry of fixture.cases) {
    assert.ok(run(entry).spent <= fixture.budget, `${entry.id}: went over budget`);
  }
});

test('spent is exactly the cost of the calls that executed', () => {
  for (const entry of fixture.cases) {
    const { executed, spent } = run(entry);
    const billed = executed.reduce(
      (sum, id) => sum + entry.calls.find((call) => call.id === id)!.tokens,
      0,
    );
    assert.equal(spent, billed, `${entry.id}: the bill does not match what ran`);
  }
});

test('every call is either executed or refused, exactly once', () => {
  for (const entry of fixture.cases) {
    const { executed, refused } = run(entry);
    assert.deepEqual(
      [...executed, ...refused].sort(),
      entry.calls.map((call) => call.id).sort(),
      `${entry.id}: a call was lost or double-counted`,
    );
  }
});

test('a smaller budget never executes more', () => {
  for (const entry of fixture.cases) {
    const tighter = enforce(entry.calls, fixture.budget - 1);
    assert.ok(
      tighter.executed.length <= run(entry).executed.length,
      `${entry.id}: a tighter budget ran more work`,
    );
  }
});
