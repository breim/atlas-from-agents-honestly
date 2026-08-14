import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Bundle, Environment, Executed, Run, execute as Execute } from './start.ts';

interface Case {
  id: string;
  run: Run;
  result: Executed;
}

const fixture = expected<{ chapter: string; environments: Environment[]; cases: Case[] }>(import.meta.url);
const { execute } = await loadImpl<{ execute: typeof Execute }>(import.meta.url);

const run = (subject: Run, environments = fixture.environments) => execute(subject, environments);
const activeAt = (at: number, environments = fixture.environments) =>
  environments.filter((entry) => entry.at <= at).at(-1)!;

const cases: Array<[string, string]> = [
  ['a-run-carries-the-bundle-it-started-with', 'resolved once, at the start'],
  ['a-deploy-mid-run-does-not-change-the-run', 'one experiment, not two spliced'],
  ['policy-resolves-at-the-moment-of-each-action', 'Friday permissions on a Monday action'],
  ['an-action-exactly-at-a-boundary-uses-the-new-policy', 'the boundary is inclusive'],
  ['editing-a-tool-description-is-a-new-configuration', 'a description is prompt text'],
  ['a-later-deploy-of-the-same-bundle-is-the-same-configuration', 'content-addressed, not git-addressed'],
  ['a-re-index-is-a-configuration-change-with-no-code-in-it', 'nothing in the commit moved'],
  ['a-run-with-no-actions-still-records-its-configuration', 'the run is the unit'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(run(entry.run), entry.result);
  });
}

test('every action carries the configuration the run started with', () => {
  for (const entry of fixture.cases) {
    const result = run(entry.run);
    for (const action of result.actions) {
      assert.equal(action.configKey, result.configKey, `${entry.id}: ${action.name} was spliced`);
    }
  }
});

test('a deploy after the run started never reaches it', () => {
  for (const entry of fixture.cases) {
    const before = run(entry.run);
    const disruptive: Environment = {
      at: entry.run.startedAt + 1,
      policyVersion: 'pol-99',
      bundle: { systemPromptId: 'sp-later', toolCatalogueHash: 'tc-later' },
    };
    const after = run(entry.run, [...fixture.environments, disruptive].sort((a, b) => a.at - b.at));
    assert.equal(after.configKey, before.configKey, `${entry.id}: a mid-run deploy moved the bundle`);
  }
});

test('the policy on an action is the one in force when it happened', () => {
  for (const entry of fixture.cases) {
    for (const action of run(entry.run).actions) {
      assert.equal(action.policy, activeAt(action.at).policyVersion, `${entry.id}: ${action.name}`);
    }
  }
});

test('a policy change after the run started does reach a later action', () => {
  for (const entry of fixture.cases) {
    if (entry.run.actions.length === 0) continue;
    const last = entry.run.actions[entry.run.actions.length - 1];
    const changed: Environment = {
      at: last.at,
      policyVersion: 'pol-tightened',
      bundle: activeAt(last.at).bundle,
    };
    const timeline = [...fixture.environments, changed].sort((a, b) => a.at - b.at);
    const result = execute(entry.run, timeline);
    assert.equal(result.actions[result.actions.length - 1].policy, 'pol-tightened', entry.id);
  }
});

test('the key depends on every field in the bundle', () => {
  const bundle = fixture.environments[0].bundle;
  for (const field of Object.keys(bundle)) {
    const moved: Bundle = { ...bundle, [field]: 'changed' };
    const timeline: Environment[] = [{ at: 0, policyVersion: 'p', bundle: moved }];
    const before = run({ startedAt: 10, actions: [] }, [fixture.environments[0]]).configKey;
    assert.notEqual(run({ startedAt: 10, actions: [] }, timeline).configKey, before, `${field} did not count`);
  }
});

test('the key does not depend on the order the fields were written in', () => {
  const bundle = fixture.environments[0].bundle;
  const reversed: Bundle = Object.fromEntries(Object.entries(bundle).reverse());
  const straight: Environment[] = [{ at: 0, policyVersion: 'p', bundle }];
  const shuffled: Environment[] = [{ at: 0, policyVersion: 'p', bundle: reversed }];
  const subject: Run = { startedAt: 10, actions: [] };
  assert.equal(run(subject, shuffled).configKey, run(subject, straight).configKey, 'the key is not canonical');
});

test('two environments holding the same bundle produce the same key', () => {
  const keys = fixture.environments.map((entry) => run({ startedAt: entry.at, actions: [] }).configKey);
  fixture.environments.forEach((entry, index) => {
    fixture.environments.forEach((other, position) => {
      const same = JSON.stringify(Object.entries(entry.bundle).sort()) === JSON.stringify(Object.entries(other.bundle).sort());
      if (same) assert.equal(keys[index], keys[position], `${entry.at} vs ${other.at}`);
    });
  });
});

test('one action out, one action in, in order', () => {
  for (const entry of fixture.cases) {
    const result = run(entry.run);
    assert.deepEqual(
      result.actions.map((action) => [action.name, action.at]),
      entry.run.actions.map((action) => [action.name, action.at]),
      entry.id,
    );
  }
});

test('starting later never picks up an earlier bundle', () => {
  const keys = fixture.environments.map((entry) => ({
    at: entry.at,
    key: run({ startedAt: entry.at, actions: [] }).configKey,
  }));
  for (const { at, key } of keys) {
    assert.equal(key, run({ startedAt: at + 1, actions: [] }).configKey, `${at}: the timeline slipped`);
  }
});
