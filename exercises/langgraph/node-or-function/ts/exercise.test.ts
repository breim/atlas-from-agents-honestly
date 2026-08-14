import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Decision, Step, decide as Decide } from './start.ts';

interface Case {
  id: string;
  step: Step;
  result: Decision;
}

const fixture = expected<{ chapter: string; cases: Case[] }>(import.meta.url);
const { decide } = await loadImpl<{ decide: typeof Decide }>(import.meta.url);

const cases: Array<[string, string]> = [
  ['a-pure-computation-is-a-plain-function', 'a pure step stays a function'],
  ['a-side-effect-makes-it-a-node', 'an effect must not be replayed'],
  ['needing-to-resume-after-it-makes-it-a-node', 'resumption needs a boundary'],
  ['needing-its-own-trace-span-makes-it-a-node', 'observability needs a span'],
  ['being-slow-alone-does-not-make-it-a-node', 'slowness on its own buys nothing'],
  ['every-reason-is-reported-not-just-the-first', 'all the grounds are written down'],
  ['two-reasons-are-both-reported', 'two grounds are both reported'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(decide(entry.step), entry.result);
  });
}

test('slowness never changes the verdict', () => {
  for (const entry of fixture.cases) {
    assert.deepEqual(
      decide({ ...entry.step, slow: !entry.step.slow }),
      decide(entry.step),
      `${entry.id}: slowness leaked into the decision`,
    );
  }
});

test('a node always has at least one reason, a function never has any', () => {
  for (const entry of fixture.cases) {
    const { verdict, reasons } = decide(entry.step);
    assert.equal(verdict === 'node', reasons.length > 0, `${entry.id}: verdict without grounds`);
  }
});

test('every combination of the three grounds is decided consistently', () => {
  for (const hasSideEffect of [true, false]) {
    for (const needsResumption of [true, false]) {
      for (const observedSeparately of [true, false]) {
        const step: Step = { hasSideEffect, needsResumption, observedSeparately, slow: false };
        const { verdict } = decide(step);
        const anyGround = hasSideEffect || needsResumption || observedSeparately;
        assert.equal(verdict, anyGround ? 'node' : 'function', JSON.stringify(step));
      }
    }
  }
});

test('adding a ground never turns a node back into a function', () => {
  for (const entry of fixture.cases) {
    for (const field of ['hasSideEffect', 'needsResumption', 'observedSeparately'] as const) {
      assert.equal(
        decide({ ...entry.step, [field]: true }).verdict,
        'node',
        `${entry.id}: setting ${field} did not force a node`,
      );
    }
  }
});
