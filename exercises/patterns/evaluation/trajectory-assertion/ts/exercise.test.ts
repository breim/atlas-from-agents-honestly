import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Assertion, Spec, assertPath as AssertPath } from './start.ts';

interface Case {
  id: string;
  steps: string[];
  result: Assertion;
}

const fixture = expected<{ chapter: string; spec: Spec; cases: Case[] }>(import.meta.url);
const { assertPath } = await loadImpl<{ assertPath: typeof AssertPath }>(import.meta.url);

const run = (entry: Case) => assertPath(entry.steps, fixture.spec);

const cases: Array<[string, string]> = [
  ['the-required-path-in-order-passes', 'the intended path passes'],
  ['extra-steps-between-required-ones-are-fine', 'the assertion does not pin the exact sequence'],
  ['a-missing-required-step-fails', 'a skipped step is caught'],
  ['the-right-steps-in-the-wrong-order-fail', 'authorising after the effect is a failure'],
  ['a-forbidden-step-fails-however-good-the-path-looks', 'a forbidden step fails the run'],
  ['violations-are-reported-together', 'every violation is reported, not just the first'],
  ['a-repeated-required-step-still-satisfies-the-order', 'a repeat does not break the order'],
  ['an-empty-trajectory-misses-everything', 'doing nothing fails every requirement'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('passing means no violations, and vice versa', () => {
  for (const entry of fixture.cases) {
    const { passed, violations } = run(entry);
    assert.equal(passed, violations.length === 0, `${entry.id}: verdict disagrees with violations`);
  }
});

test('a trajectory containing a forbidden step never passes', () => {
  for (const entry of fixture.cases) {
    const tainted = [...entry.steps, fixture.spec.forbids[0]];
    assert.equal(
      assertPath(tainted, fixture.spec).passed,
      false,
      `${entry.id}: passed with a forbidden step appended`,
    );
  }
});

test('dropping a required step never keeps a passing trajectory passing', () => {
  for (const entry of fixture.cases) {
    if (!run(entry).passed) continue;
    for (const required of fixture.spec.requires) {
      const without = entry.steps.filter((step) => step !== required);
      assert.equal(
        assertPath(without, fixture.spec).passed,
        false,
        `${entry.id}: still passed without ${required}`,
      );
    }
  }
});

test('reversing a passing trajectory does not still pass', () => {
  for (const entry of fixture.cases) {
    if (!run(entry).passed || fixture.spec.requires.length < 2) continue;
    assert.equal(
      assertPath([...entry.steps].reverse(), fixture.spec).passed,
      false,
      `${entry.id}: order is not being checked`,
    );
  }
});
