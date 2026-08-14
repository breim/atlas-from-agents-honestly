import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Composition, Mode, Step, compose as Compose } from './start.ts';

interface Case {
  id: string;
  mode: Mode;
  steps: Step[];
  result: Composition;
}

const fixture = expected<{ chapter: string; limit: number; cases: Case[] }>(import.meta.url);
const { compose } = await loadImpl<{ compose: typeof Compose }>(import.meta.url);

const run = (entry: Case) => compose(entry.steps, entry.mode, fixture.limit);

const cases: Array<[string, string]> = [
  ['sequential-elapsed-is-the-sum', 'one after another costs the sum'],
  ['parallel-elapsed-is-the-slowest-step', 'all at once costs the slowest'],
  ['fanout-elapsed-is-the-sum-of-each-waves-slowest', 'a cap puts you between the two'],
  ['results-follow-declaration-order-not-completion-order', 'finishing first does not mean first'],
  ['a-failing-step-does-not-stop-its-siblings', 'a parallel failure is contained'],
  ['a-failing-step-does-not-stop-a-sequence-either', 'a sequential failure is too'],
  ['a-single-step-costs-the-same-in-every-shape', 'one step has no shape to speak of'],
  ['no-steps-take-no-time', 'nothing to do takes no time'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('every step is reported exactly once, in declaration order', () => {
  for (const entry of fixture.cases) {
    const { results, failed } = run(entry);
    const order = entry.steps.map((step) => step.id);
    assert.deepEqual([...results, ...failed].sort(), [...order].sort(), entry.id);
    for (const lane of [results, failed]) {
      assert.deepEqual(order.filter((id) => lane.includes(id)), lane, `${entry.id}: reordered`);
    }
  }
});

test('the shape never changes which steps succeeded', () => {
  for (const entry of fixture.cases) {
    for (const mode of ['sequential', 'parallel', 'fanout'] as Mode[]) {
      const other = compose(entry.steps, mode, fixture.limit);
      assert.deepEqual(other.results, run(entry).results, `${entry.id}: ${mode} changed results`);
      assert.deepEqual(other.failed, run(entry).failed, `${entry.id}: ${mode} changed failures`);
    }
  }
});

test('parallel is never slower than fan-out, which is never slower than sequential', () => {
  for (const entry of fixture.cases) {
    const parallel = compose(entry.steps, 'parallel', fixture.limit).elapsed;
    const fanout = compose(entry.steps, 'fanout', fixture.limit).elapsed;
    const sequential = compose(entry.steps, 'sequential', fixture.limit).elapsed;
    assert.ok(parallel <= fanout, `${entry.id}: parallel slower than fan-out`);
    assert.ok(fanout <= sequential, `${entry.id}: fan-out slower than sequential`);
  }
});

test('a failing step still costs its time', () => {
  for (const entry of fixture.cases) {
    if (entry.mode !== 'sequential') continue;
    assert.equal(
      run(entry).elapsed,
      entry.steps.reduce((sum, step) => sum + step.ms, 0),
      `${entry.id}: a failure was billed as free`,
    );
  }
});

test('a fan-out cap at least as wide as the work equals parallel', () => {
  for (const entry of fixture.cases) {
    assert.equal(
      compose(entry.steps, 'fanout', Math.max(1, entry.steps.length)).elapsed,
      compose(entry.steps, 'parallel', fixture.limit).elapsed,
      `${entry.id}: an uncapped fan-out was not parallel`,
    );
  }
});
