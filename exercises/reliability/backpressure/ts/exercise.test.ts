import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Admission, Config, Priority, Run, Used, admit as Admit } from './start.ts';

interface Case {
  id: string;
  profile?: Config['profile'];
  run: Run;
  used: Used;
  result: Admission;
}

const fixture = expected<{ chapter: string; config: Config; cases: Case[] }>(import.meta.url);
const { admit } = await loadImpl<{ admit: typeof Admit }>(import.meta.url);

const configFor = (entry: Case, overrides: Partial<Config> = {}): Config => ({
  ...fixture.config,
  ...(entry.profile ? { profile: entry.profile } : {}),
  ...overrides,
});
const run = (entry: Case, request = entry.run, used = entry.used, overrides: Partial<Config> = {}) =>
  admit(request, used, configFor(entry, overrides));
const PRIORITIES: Priority[] = ['interactive', 'background', 'batch'];

const cases: Array<[string, string]> = [
  ['an-interactive-run-with-headroom-is-admitted', 'the ordinary path'],
  ['a-batch-job-cannot-cross-the-interactive-floor', 'the 2am incident, prevented'],
  ['a-saturated-batch-share-does-not-touch-interactive', 'the floor holds under batch load'],
  ['retries-count-against-the-same-quota', 'they bypass the door otherwise'],
  ['one-tenant-burst-cannot-starve-the-others', 'the class had room; the tenant did not'],
  ['the-class-budget-is-checked-before-the-tenant-cap', 'the check order is fixed'],
  ['a-run-exactly-at-the-budget-is-admitted', 'the boundary is inclusive'],
  ['one-token-over-is-refused', 'and one over it is not'],
  ['a-longer-run-lowers-the-ceiling-further', 'one run against two million tokens'],
  ['a-tenant-nobody-has-seen-starts-from-zero', 'an absent tenant is not a full one'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('the class shares never over-allocate the effective quota', () => {
  for (const entry of fixture.cases) {
    const budgets = PRIORITIES.map((priority) => run(entry, { ...entry.run, priority }).classBudget);
    const effective = Math.floor((fixture.config.inputTpm * fixture.config.clientLimitBps) / 10000);
    assert.ok(budgets.reduce((sum, value) => sum + value, 0) <= effective, `${entry.id}: the shares overcommit`);
    assert.ok(effective <= fixture.config.inputTpm, `${entry.id}: the client limiter is not below the provider`);
  }
});

test('a refusal always says when to come back, and an admission never waits', () => {
  for (const entry of fixture.cases) {
    const { admitted, reason, retryAfterMs } = run(entry);
    assert.equal(admitted, reason === null, `${entry.id}: ${reason}`);
    if (admitted) assert.equal(retryAfterMs, 0, `${entry.id}: an admitted run was told to wait`);
    else assert.ok(retryAfterMs > 0, `${entry.id}: a refusal gave the caller nothing to act on`);
  }
});

test('headroom is what the class has left after new work and retries', () => {
  for (const entry of fixture.cases) {
    const { classBudget, headroom } = run(entry);
    const spent =
      entry.used.byPriority[entry.run.priority] + entry.used.retriesByPriority[entry.run.priority];
    assert.equal(headroom, classBudget - spent, `${entry.id}: the accounting misses something`);
  }
});

test('forgetting the retries would have admitted work there was no room for', () => {
  for (const entry of fixture.cases) {
    const honest = run(entry);
    const blind: Used = { ...entry.used, retriesByPriority: { interactive: 0, background: 0, batch: 0 } };
    const optimistic = run(entry, entry.run, blind);
    assert.ok(optimistic.headroom >= honest.headroom, `${entry.id}: retries were free`);
    if (honest.admitted) assert.ok(optimistic.admitted, `${entry.id}: counting less admitted less`);
  }
});

test('saturating every other class never changes an interactive verdict', () => {
  for (const entry of fixture.cases) {
    const request: Run = { ...entry.run, priority: 'interactive' };
    const quiet = run(entry, request);
    const busy = run(entry, request, {
      ...entry.used,
      byPriority: { ...entry.used.byPriority, background: 100_000_000, batch: 100_000_000 },
    });
    assert.deepEqual(busy, quiet, `${entry.id}: another class reached across the floor`);
  }
});

test('a tenant that has spent more is never admitted more easily', () => {
  for (const entry of fixture.cases) {
    const before = run(entry).admitted;
    const heavier = run(entry, entry.run, {
      ...entry.used,
      byTenant: { ...entry.used.byTenant, [entry.run.tenantId]: 100_000_000 },
    });
    assert.ok(!heavier.admitted || before, `${entry.id}: spending more bought more`);
    assert.equal(heavier.admitted, false, `${entry.id}: the tenant cap did not bind`);
  }
});

test('a bigger estimate is never admitted more easily', () => {
  for (const entry of fixture.cases) {
    const before = run(entry).admitted;
    const bigger = run(entry, { ...entry.run, estInputTokens: entry.run.estInputTokens + 1_000_000 });
    assert.ok(!bigger.admitted || before, `${entry.id}: a longer run got in more easily`);
  }
});

test('the ceiling depends on the workload profile and nothing else', () => {
  for (const entry of fixture.cases) {
    const baseline = run(entry).effectiveConcurrentRuns;
    const elsewhere = run(entry, { priority: 'batch', tenantId: 'someone-else', estInputTokens: 1 }, {
      byPriority: { interactive: 5, background: 5, batch: 5 },
      retriesByPriority: { interactive: 5, background: 5, batch: 5 },
      byTenant: { 'someone-else': 5 },
    });
    assert.equal(elsewhere.effectiveConcurrentRuns, baseline, `${entry.id}: the wall number moved with traffic`);
  }
});

test('a heavier workload profile never raises the ceiling', () => {
  for (const entry of fixture.cases) {
    const profile = configFor(entry).profile;
    const heavier = run(entry, entry.run, entry.used, {
      profile: { ...profile, turnsPerMinute: profile.turnsPerMinute * 2 },
    });
    assert.ok(
      heavier.effectiveConcurrentRuns <= run(entry).effectiveConcurrentRuns,
      `${entry.id}: chattier runs fit better`,
    );
  }
});
