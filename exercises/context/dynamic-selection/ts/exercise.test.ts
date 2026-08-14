import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Catalogue, Config, Profile, Run, Selection, select as Select } from './start.ts';

interface Case {
  id: string;
  config?: Config;
  run: Run;
  result: Selection;
}

interface Fixture {
  chapter: string;
  catalogue: Catalogue;
  profiles: Record<string, Profile>;
  config: Config;
  cases: Case[];
}

const fixture = expected<Fixture>(import.meta.url);
const { select } = await loadImpl<{ select: typeof Select }>(import.meta.url);

const configOf = (entry: Case) => entry.config ?? fixture.config;
const go = (entry: Case, config = configOf(entry), run = entry.run) =>
  select(run, fixture.profiles, fixture.catalogue, config);

const cases: Array<[string, string]> = [
  ['a-profile-is-chosen-once-and-held-for-the-whole-run', 'the prefix survives the run'],
  ['selecting-per-request-turns-every-step-into-a-cache-miss', 'saved schemas, paid for everything else'],
  ['a-tool-that-is-not-loaded-cannot-be-called', 'selection is a blast-radius control'],
  ['an-addition-at-the-end-does-not-cost-the-cache', 'surfaced, not swapped'],
  ['a-substitution-at-the-front-costs-everything-behind-it', 'position zero changed'],
  ['shipping-every-tool-loads-the-one-that-moves-money', 'the union of everything'],
  ['an-unknown-category-falls-back-without-loading-a-write-tool', 'a fallback that cannot spend'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(go(entry), entry.result);
  });
}

test('a call to a tool the profile did not load is refused, never used', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    for (const tool of outcome.refused) {
      assert.ok(!outcome.offered.includes(tool), `${entry.id}: ${tool} was refused while offered`);
      assert.ok(!outcome.used.includes(tool), `${entry.id}: ${tool} was refused and used`);
    }
    for (const tool of outcome.used) {
      assert.ok(outcome.offered.includes(tool), `${entry.id}: ${tool} was used without being offered`);
    }
  }
});

test('a write tool is callable only when the profile names it', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    const asked = entry.run.steps.some((step) => step.calls.includes('issue_credit'));
    if (!asked) continue;
    const loaded = outcome.offered.includes('issue_credit');
    assert.equal(outcome.used.includes('issue_credit'), loaded, `${entry.id}: blast radius did not follow the profile`);
    assert.equal(outcome.refused.includes('issue_credit'), !loaded, entry.id);
  }
});

test('offered and used partition into exactly what was dead weight', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    assert.deepEqual(
      outcome.neverCalled,
      outcome.offered.filter((tool) => !outcome.used.includes(tool)),
      `${entry.id}: dead weight was miscounted`,
    );
    assert.equal(new Set(outcome.offered).size, outcome.offered.length, `${entry.id}: a tool was offered twice`);
  }
});

test('holding one profile keeps every step after the first on a cache hit', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry, { ...configOf(entry), selectPerRequest: false });
    assert.equal(outcome.steps[0].cached, false, `${entry.id}: the first step cannot be a hit`);
    for (const step of outcome.steps.slice(1)) {
      assert.equal(step.cached, true, `${entry.id}: step ${step.step} missed on a stable prefix`);
    }
  }
});

test('the prefix is identical at every step unless the profile is reselected', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry, { ...configOf(entry), selectPerRequest: false });
    const first = outcome.steps[0].prefixTokens;
    for (const step of outcome.steps) {
      assert.equal(step.prefixTokens, first, `${entry.id}: position zero moved at step ${step.step}`);
    }
  }
});

test('a step is a hit exactly when its prefix matches the step before it', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    outcome.steps.forEach((step, index) => {
      const owed = index > 0 && outcome.steps[index - 1].prefixTokens === step.prefixTokens;
      assert.equal(step.cached, owed, `${entry.id}: step ${step.step} cached wrongly`);
    });
  }
});

test('an addition never changes the prefix it lands behind', () => {
  const entry = findCase<Case>(fixture, 'an-addition-at-the-end-does-not-cost-the-cache');
  const without = go(entry, configOf(entry), {
    ...entry.run,
    steps: entry.run.steps.map((step) => ({ ...step, additions: [] })),
  });
  const with_ = go(entry);
  assert.deepEqual(
    with_.steps.map((step) => step.prefixTokens),
    without.steps.map((step) => step.prefixTokens),
    'surfacing a tool rewrote position zero',
  );
  assert.deepEqual(
    with_.steps.map((step) => step.cached),
    without.steps.map((step) => step.cached),
    'surfacing a tool cost a cache hit',
  );
  assert.ok(with_.offered.length > without.offered.length, 'the addition was never surfaced');
});

test('an addition adds its own schema cost to the step it lands in', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    outcome.steps.forEach((step, index) => {
      const source = entry.run.steps[index];
      const owed = source.additions.reduce((total, tool) => total + fixture.catalogue.tools[tool], 0);
      assert.equal(
        step.variableTokens,
        source.variableTokens + owed,
        `${entry.id}: step ${step.step} priced its additions wrongly`,
      );
    });
  }
});

test('an unrecognised category gets the default profile and nothing more', () => {
  const entry = findCase<Case>(fixture, 'a-profile-is-chosen-once-and-held-for-the-whole-run');
  const unknown = { ...entry.run, category: 'no_such_category' };
  const outcome = go(entry, { ...configOf(entry), selectPerRequest: false }, unknown);
  assert.deepEqual(outcome.offered, fixture.profiles.default.tools, 'the fallback loaded more than the default');
  assert.equal(outcome.namespace, fixture.profiles.default.namespace);
  for (const step of outcome.steps) {
    assert.equal(step.prefixTokens, fixture.catalogue.systemTokens + fixture.catalogue.tools.escalate_to_human);
  }
});

test('reselecting per request never bills less than holding the profile', () => {
  for (const entry of fixture.cases) {
    const held = go(entry, { ...configOf(entry), selectPerRequest: false });
    const churned = go(entry, { ...configOf(entry), selectPerRequest: true });
    assert.ok(churned.billedTokens >= held.billedTokens, `${entry.id}: churn was somehow cheaper`);
  }
});

test('the bill is computed from the prefix, not assumed', () => {
  for (const entry of fixture.cases) {
    const { cacheReadBps } = configOf(entry);
    const outcome = go(entry);
    let owed = 0;
    for (const step of outcome.steps) {
      const prefix = step.cached ? Math.floor((step.prefixTokens * cacheReadBps) / 10000 + 0.5) : step.prefixTokens;
      assert.equal(step.billedTokens, prefix + step.variableTokens, `${entry.id}: step ${step.step} was mispriced`);
      owed += step.billedTokens;
    }
    assert.equal(outcome.billedTokens, owed, `${entry.id}: the total disagrees with its steps`);
  }
});

test('a cheaper cache read never makes a miss cheaper than a hit', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    for (const step of outcome.steps) {
      if (!step.cached) continue;
      assert.ok(step.billedTokens < step.prefixTokens + step.variableTokens, `${entry.id}: a hit billed full price`);
    }
  }
});
