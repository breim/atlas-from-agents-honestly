import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Decision, Policy, decide as Decide } from './start.ts';

interface Case {
  id: string;
  samples: number;
  rate: number;
  decision: Decision;
}

const fixture = expected<Policy & { chapter: string; cases: Case[] }>(import.meta.url);
const policy: Policy = {
  baseline: fixture.baseline,
  tolerance: fixture.tolerance,
  minSamples: fixture.minSamples,
};
const { decide } = await loadImpl<{ decide: typeof Decide }>(import.meta.url);

const run = (entry: Case) => decide(entry.samples, entry.rate, policy);

const cases: Array<[string, string]> = [
  ['too-few-samples-holds-whatever-the-rate', 'a great rate on no data is still no data'],
  ['too-few-samples-holds-even-when-the-rate-is-terrible', 'a bad rate on no data is also no data'],
  ['matching-the-baseline-promotes', 'parity is good enough to ship'],
  ['beating-the-baseline-promotes', 'better than parity certainly is'],
  ['a-small-regression-inside-tolerance-holds', 'a mild regression is neither ship nor revert'],
  ['exactly-at-the-tolerance-floor-holds', 'the floor is inclusive'],
  ['past-the-tolerance-floor-rolls-back', 'one basis point past the floor reverts'],
  ['exactly-at-the-sample-floor-is-enough-evidence', 'the sample floor is inclusive too'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.decision);
  });
}

test('nothing is ever promoted or rolled back below the sample floor', () => {
  for (const entry of fixture.cases) {
    if (entry.samples >= policy.minSamples) continue;
    assert.equal(run(entry).action, 'hold', `${entry.id}: acted on insufficient evidence`);
  }
});

test('promotion only happens at or above the baseline', () => {
  for (const entry of fixture.cases) {
    if (run(entry).action !== 'promote') continue;
    assert.ok(entry.rate >= policy.baseline, `${entry.id}: promoted below the baseline`);
  }
});

test('rollback only happens past the tolerance floor', () => {
  for (const entry of fixture.cases) {
    if (run(entry).action !== 'rollback') continue;
    assert.ok(
      entry.rate < policy.baseline - policy.tolerance,
      `${entry.id}: rolled back inside tolerance`,
    );
  }
});

test('a better rate never produces a worse action', () => {
  const rank = { rollback: 0, hold: 1, promote: 2 };
  for (const entry of fixture.cases) {
    const better = decide(entry.samples, entry.rate + 1, policy);
    assert.ok(
      rank[better.action] >= rank[run(entry).action],
      `${entry.id}: a higher rate produced a worse decision`,
    );
  }
});
