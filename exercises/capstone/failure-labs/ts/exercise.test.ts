import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Lab, Policy, Report, assess as AssessFn } from './start.ts';

interface Case { id: string; labs: Lab[]; policy: Policy; result: Report }
interface Fixture { chapter: string; policy: Policy; cases: Case[] }

const fixture = expected<Fixture>(import.meta.url);
const { assess } = await loadImpl<{ assess: typeof AssessFn }>(import.meta.url);
const go = (entry: Case, labs = entry.labs) => assess(labs, entry.policy);

const cases: Array<[string, string]> = [
  ['a-lab-that-declares-everything-before-injecting-is-valid', 'four things, up front'],
  ['a-lab-with-no-declared-invariant-proves-nothing', 'what are you asserting'],
  ['a-lab-with-no-window-cannot-say-when-it-injected', 'when did the fault land'],
  ['a-lab-that-collects-no-evidence-cannot-be-reviewed', 'nothing to read afterwards'],
  ['inspecting-the-return-status-misses-the-effect', 'the error that still moved money'],
  ['isolation-must-be-asserted-before-reranking', 'before every hop'],
  ['an-admitted-bypass-is-not-the-same-finding-as-an-attempted-one', 'two different results'],
  ['a-bound-with-no-terminal-business-policy-is-a-dead-end', 'halted, and then what'],
  ['a-finding-promoted-nowhere-will-happen-again', 'the lowest layer that prevents it'],
  ['cleanup-before-preservation-destroys-the-evidence', 'preserve, then clean'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(go(entry), entry.result);
  });
}

test('each of the four declarations is required on its own', () => {
  const entry = findCase<Case>(fixture, 'a-lab-that-declares-everything-before-injecting-is-valid');
  for (const field of [...entry.policy.required, 'evidence']) {
    const labs = entry.labs.map((lab) => ({ ...lab, [field]: field === 'evidence' ? [] : null }));
    const outcome = go(entry, labs);
    assert.equal(outcome.status, 'incomplete', `a lab with no ${field} was accepted`);
    assert.ok(
      outcome.verdicts[0].errors.some((error) => error.includes(field)),
      `${field} was refused without naming it`,
    );
  }
});

test('every isolation checkpoint must be asserted before', () => {
  const entry = findCase<Case>(fixture, 'a-lab-that-declares-everything-before-injecting-is-valid');
  for (const checkpoint of entry.policy.isolationCheckpoints) {
    const labs = entry.labs.map((lab) => ({
      ...lab,
      assertsBefore: lab.assertsBefore.filter((item) => item !== checkpoint),
    }));
    const outcome = go(entry, labs);
    assert.equal(outcome.status, 'incomplete', `skipping ${checkpoint} was accepted`);
    assert.ok(outcome.verdicts[0].errors.some((error) => error.includes(checkpoint)), `${checkpoint} unnamed`);
  }
});

test('an attempted bypass and an admitted one are counted apart', () => {
  const entry = findCase<Case>(fixture, 'an-admitted-bypass-is-not-the-same-finding-as-an-attempted-one');
  const outcome = go(entry);
  assert.ok(outcome.attemptedBypasses.length > 0, 'the fixture no longer attempts a bypass');
  assert.ok(outcome.admittedBypasses.length > 0, 'the fixture no longer admits one');
  for (const name of outcome.admittedBypasses) {
    assert.ok(!outcome.attemptedBypasses.includes(name), `${name} was counted twice`);
  }
});

test('an admitted bypass makes the suite incomplete even when every lab is valid', () => {
  const entry = findCase<Case>(fixture, 'a-lab-that-declares-everything-before-injecting-is-valid');
  const attempted = go(entry, entry.labs.map((lab) => ({ ...lab, bypass: 'attempted' as const })));
  assert.equal(attempted.status, 'complete', 'an attempted bypass failed the suite');
  const admitted = go(entry, entry.labs.map((lab) => ({ ...lab, bypass: 'admitted' as const })));
  assert.equal(admitted.status, 'incomplete', 'an admitted bypass passed the suite');
  assert.deepEqual(
    admitted.verdicts.map((verdict) => verdict.status),
    attempted.verdicts.map((verdict) => verdict.status),
    'an admitted bypass invalidated the labs themselves',
  );
});

test('inspecting only the return status is always refused', () => {
  const entry = findCase<Case>(fixture, 'a-lab-that-declares-everything-before-injecting-is-valid');
  for (const inspects of ['effect-state', 'return-status'] as const) {
    const outcome = go(entry, entry.labs.map((lab) => ({ ...lab, inspects })));
    assert.equal(outcome.status === 'complete', inspects === 'effect-state', inspects);
  }
});

test('a finding is promoted to a known layer or the lab is invalid', () => {
  const entry = findCase<Case>(fixture, 'a-lab-that-declares-everything-before-injecting-is-valid');
  for (const promotedTo of [...entry.policy.layers, null, 'nowhere'] as const) {
    const outcome = go(entry, entry.labs.map((lab) => ({ ...lab, promotedTo: promotedTo as Lab['promotedTo'] })));
    const owed = promotedTo !== null && entry.policy.layers.includes(promotedTo as string);
    assert.equal(outcome.status === 'complete', owed, `promoted to ${promotedTo}`);
    assert.equal(outcome.verdicts[0].promotedTo, owed ? promotedTo : null, `promotedTo for ${promotedTo}`);
  }
});

test('an invalid lab reports no promotion', () => {
  for (const entry of fixture.cases) {
    for (const verdict of go(entry).verdicts) {
      if (verdict.status !== 'invalid') continue;
      assert.equal(verdict.promotedTo, null, `${entry.id}: an invalid lab claimed a promotion`);
      assert.ok(verdict.errors.length > 0, `${entry.id}: an invalid lab gave no reason`);
    }
  }
});

test('every lab gets exactly one verdict, in order', () => {
  for (const entry of fixture.cases) {
    assert.deepEqual(
      go(entry).verdicts.map((verdict) => verdict.lab),
      entry.labs.map((lab) => lab.name),
      `${entry.id}: verdicts and labs disagree`,
    );
  }
});

test('a bound with no terminal policy and lost artifacts are each fatal on their own', () => {
  const entry = findCase<Case>(fixture, 'a-lab-that-declares-everything-before-injecting-is-valid');
  for (const field of ['boundHasTerminalPolicy', 'artifactsPreserved'] as const) {
    const outcome = go(entry, entry.labs.map((lab) => ({ ...lab, [field]: false })));
    assert.equal(outcome.status, 'incomplete', `${field} false was accepted`);
    assert.equal(outcome.verdicts[0].status, 'invalid', `${field} did not invalidate the lab`);
  }
});
