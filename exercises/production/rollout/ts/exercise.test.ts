import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Assignment, Request, Rollout, assign as Assign } from './start.ts';

interface Case {
  id: string;
  change: string;
  request: Request;
  result: Assignment;
}

const fixture = expected<{ chapter: string; rollout: Rollout; cases: Case[] }>(import.meta.url);
const { assign } = await loadImpl<{ assign: typeof Assign }>(import.meta.url);

const run = (entry: Case, request = entry.request, rollout = fixture.rollout, change = entry.change) =>
  assign(request, rollout, change);

const cases: Array<[string, string]> = [
  ['a-tenant-inside-the-canary-fraction-gets-the-candidate', 'the only rung with real risk'],
  ['a-tenant-outside-it-stays-on-stable', 'most traffic never notices'],
  ['a-holdout-tenant-is-never-canaried', 'the bucket said yes and the holdout won'],
  ['the-canary-boundary-is-exclusive', 'the fraction is a fraction'],
  ['a-fresh-run-ignores-a-pinned-bundle', 'a new run has nothing to carry'],
  ['a-quality-change-resumes-on-the-bundle-it-started-with', 'the run is half-decided'],
  ['a-bug-fix-migrates-the-run', 'the run is currently producing the bug'],
  ['a-policy-change-always-migrates', 'old rules must not govern today'],
  ['a-run-paused-since-tuesday-acts-under-todays-rules', 'the prompt is pinned; the policy is not'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('the policy version is never the pinned one', () => {
  for (const entry of fixture.cases) {
    for (const pinnedPolicyVersion of ['pol-1', 'pol-99', null]) {
      const result = run(entry, { ...entry.request, pinnedPolicyVersion });
      assert.equal(result.policyVersion, fixture.rollout.policyVersion, `${entry.id}: Tuesday's rules survived`);
    }
  }
});

test('a holdout tenant never receives the candidate on a fresh run', () => {
  for (const bucketBps of [0, 100, 499, 500, 9999]) {
    const request: Request = {
      tenantId: fixture.rollout.holdout[0],
      bucketBps,
      resuming: false,
      pinnedBundleId: null,
      pinnedPolicyVersion: null,
    };
    const result = assign(request, fixture.rollout, 'quality');
    assert.equal(result.bundleId, fixture.rollout.stable, `bucket ${bucketBps} canaried a holdout`);
    assert.equal(result.reason, 'holdout', `${bucketBps}`);
  }
});

test('the same tenant at the same bucket always lands the same way', () => {
  for (const entry of fixture.cases) {
    assert.deepEqual(run(entry), run(entry), `${entry.id}: assignment is not sticky`);
    const again = run(entry, { ...entry.request });
    assert.deepEqual(again, run(entry), `${entry.id}: assignment moved between calls`);
  }
});

test('a fresh run never reads the pinned bundle', () => {
  for (const entry of fixture.cases) {
    if (entry.request.resuming) continue;
    for (const pinnedBundleId of ['bundle-Z', 'bundle-A', null]) {
      assert.deepEqual(run(entry, { ...entry.request, pinnedBundleId }), run(entry), entry.id);
    }
  }
});

test('a quality change never migrates a resuming run', () => {
  for (const entry of fixture.cases) {
    const resuming: Request = { ...entry.request, resuming: true, pinnedBundleId: 'bundle-A' };
    const result = run(entry, resuming, fixture.rollout, 'quality');
    assert.equal(result.bundleId, 'bundle-A', `${entry.id}: a half-decided run was spliced`);
    assert.equal(result.reason, 'pinned_at_start', entry.id);
  }
});

test('a bug fix or a policy change always migrates a resuming run', () => {
  for (const entry of fixture.cases) {
    for (const change of ['bugfix', 'policy']) {
      const resuming: Request = { ...entry.request, resuming: true, pinnedBundleId: 'bundle-A' };
      const result = run(entry, resuming, fixture.rollout, change);
      assert.equal(result.bundleId, fixture.rollout.candidate, `${entry.id}/${change}: the fix did not land`);
    }
  }
});

test('a resuming run never re-rolls the bucket', () => {
  for (const entry of fixture.cases) {
    const resuming: Request = { ...entry.request, resuming: true, pinnedBundleId: 'bundle-A' };
    const low = run(entry, { ...resuming, bucketBps: 0 });
    const high = run(entry, { ...resuming, bucketBps: 9999 });
    assert.deepEqual(low, high, `${entry.id}: resuming consulted the canary fraction`);
  }
});

test('nobody is canaried at zero percent, and everyone but the holdout at a hundred', () => {
  for (const entry of fixture.cases) {
    if (entry.request.resuming) continue;
    const none = run(entry, entry.request, { ...fixture.rollout, canaryFractionBps: 0 });
    assert.equal(none.bundleId, fixture.rollout.stable, `${entry.id}: served a candidate at zero`);
    const all = run(entry, entry.request, { ...fixture.rollout, canaryFractionBps: 10000 });
    const held = fixture.rollout.holdout.includes(entry.request.tenantId);
    assert.equal(all.bundleId, held ? fixture.rollout.stable : fixture.rollout.candidate, entry.id);
  }
});

test('widening the fraction never moves a tenant off the candidate', () => {
  for (const entry of fixture.cases) {
    if (entry.request.resuming) continue;
    const before = run(entry);
    if (before.bundleId !== fixture.rollout.candidate) continue;
    for (const canaryFractionBps of [600, 2000, 10000]) {
      const after = run(entry, entry.request, { ...fixture.rollout, canaryFractionBps });
      assert.equal(after.bundleId, fixture.rollout.candidate, `${entry.id}: ${canaryFractionBps} dropped a tenant`);
    }
  }
});
