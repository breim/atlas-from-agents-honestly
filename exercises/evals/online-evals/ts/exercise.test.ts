import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Plan, Policy, Run, plan as PlanFn } from './start.ts';

interface Case {
  id: string;
  runs: Run[];
  result: Plan;
}

const fixture = expected<{ chapter: string; policy: Policy; cases: Case[] }>(import.meta.url);
const { plan } = await loadImpl<{ plan: typeof PlanFn }>(import.meta.url);

const run = (runs: Run[], policy = fixture.policy) => plan(runs, policy);
const flagged = (entry: Run) => fixture.policy.always.some((name) => entry[name as keyof Run] === true);

const cases: Array<[string, string]> = [
  ['the-baseline-samples-a-fixed-share', 'a slice of everything'],
  ['every-escalation-is-scored-whatever-the-baseline-says', 'oversample where failures live'],
  ['a-run-can-match-more-than-one-stratum', 'two reasons, one score'],
  ['a-flagged-run-that-is-also-a-baseline-hit-is-scored-once', 'no double counting'],
  ['shadow-cannot-validate-a-write', 'nothing happened, so nothing was proved'],
  ['canary-is-what-validates-the-write-path', 'real consequences, small blast radius'],
  ['a-mixed-rollout-reports-the-gap', 'half the writes are still unproven'],
  ['no-traffic-scores-nothing', 'no runs, no plan'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(run(entry.runs), entry.result);
  });
}

test('every run matching a stratum is scored', () => {
  for (const entry of fixture.cases) {
    const { scored } = run(entry.runs);
    for (const candidate of entry.runs.filter(flagged)) {
      assert.ok(scored.includes(candidate.id), `${entry.id}: ${candidate.id} was a failure nobody looked at`);
    }
  }
});

test('the scored list has no duplicates and keeps the traffic order', () => {
  for (const entry of fixture.cases) {
    const { scored } = run(entry.runs);
    assert.equal(new Set(scored).size, scored.length, `${entry.id}: a run was scored twice`);
    const order = entry.runs.filter((candidate) => scored.includes(candidate.id)).map((candidate) => candidate.id);
    assert.deepEqual(scored, order, `${entry.id}: the plan reordered the traffic`);
  }
});

test('nothing is scored that was not in the traffic', () => {
  for (const entry of fixture.cases) {
    const ids = new Set(entry.runs.map((candidate) => candidate.id));
    for (const id of run(entry.runs).scored) assert.ok(ids.has(id), `${entry.id}: scored a phantom ${id}`);
  }
});

test('a non-empty failure stratum is never sampled less than plain traffic', () => {
  for (const entry of fixture.cases) {
    const { rateBps } = run(entry.runs);
    for (const name of fixture.policy.always) {
      if (!entry.runs.some((candidate) => candidate[name as keyof Run] === true)) continue;
      assert.ok(rateBps[name] >= rateBps.plain, `${entry.id}: ${name} was undersampled`);
    }
  }
});

test('a shadow run that wanted to write is always reported as unproven', () => {
  for (const entry of fixture.cases) {
    const { writes } = run(entry.runs);
    for (const candidate of entry.runs) {
      const unproven = candidate.requestsWrite && candidate.stage === 'shadow';
      assert.equal(writes.unvalidated.includes(candidate.id), unproven, `${entry.id}: ${candidate.id}`);
    }
  }
});

test('the write accounting covers every requested write exactly once', () => {
  for (const entry of fixture.cases) {
    const { writes } = run(entry.runs);
    const requested = entry.runs.filter((candidate) => candidate.requestsWrite).length;
    assert.equal(writes.requested, requested, entry.id);
    assert.equal(writes.validated + writes.unvalidated.length, requested, `${entry.id}: a write went missing`);
    assert.equal(writes.coverageBps, requested === 0 ? 0 : Math.floor((writes.validated * 10000) / requested + 0.5), entry.id);
  }
});

test('promoting shadow traffic to canary is what closes the write gap', () => {
  for (const entry of fixture.cases) {
    const promoted = entry.runs.map((candidate) => ({ ...candidate, stage: 'canary' as const }));
    const { writes } = run(promoted);
    assert.deepEqual(writes.unvalidated, [], `${entry.id}: canary left a write unproven`);
    assert.equal(writes.coverageBps, writes.requested === 0 ? 0 : 10000, entry.id);
  }
});

test('sampling everything scores everything', () => {
  for (const entry of fixture.cases) {
    const { scored, rateBps } = run(entry.runs, { ...fixture.policy, baselineEveryNth: 1 });
    assert.deepEqual(scored, entry.runs.map((candidate) => candidate.id), entry.id);
    assert.equal(rateBps.overall, entry.runs.length === 0 ? 0 : 10000, entry.id);
  }
});

test('a sparser baseline never scores more runs', () => {
  for (const entry of fixture.cases) {
    const sparser = run(entry.runs, { ...fixture.policy, baselineEveryNth: fixture.policy.baselineEveryNth * 100 });
    assert.ok(sparser.scored.length <= run(entry.runs).scored.length, `${entry.id}: less sampling scored more`);
  }
});
