import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Policy, Suite, Verdict, audit as AuditFn } from './start.ts';

interface Case { id: string; suite: Suite; question: 'did-it-change' | 'how-good-is-it'; policy: Policy; result: Verdict }
interface Fixture { chapter: string; policy: Policy; cases: Case[] }

const fixture = expected<Fixture>(import.meta.url);
const { audit } = await loadImpl<{ audit: typeof AuditFn }>(import.meta.url);
const go = (entry: Case, suite = entry.suite, question = entry.question, policy = entry.policy) =>
  audit(suite, policy, question);

const cases: Array<[string, string]> = [
  ['a-set-sized-for-the-regression-that-matters-is-sound', 'derive the size from the effect'],
  ['twenty-cases-cannot-gate-anything-judged', 'a coin flip with a changelog'],
  ['a-deterministic-assertion-gates-at-any-set-size', 'no sampling error'],
  ['a-two-point-regression-is-not-detectable-by-anything-realistic', 'that is information'],
  ['an-ungated-criterion-is-reported-rather-than-refused', 'gate what you can detect'],
  ['sixty-judged-gates-flake-by-construction', 'three false alarms per run'],
  ['a-quality-claim-needs-production-settings-and-several-seeds', 'a system nobody runs'],
  ['the-quality-question-answered-properly', 'two configurations'],
  ['an-undeclared-rerun-policy-is-p-hacking', 'declared beforehand is a design'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(go(entry), entry.result);
  });
}

test('the detectable effect follows the set size, at every step of the table', () => {
  const entry = findCase<Case>(fixture, 'a-set-sized-for-the-regression-that-matters-is-sound');
  const table = Object.entries(entry.policy.detectableAt)
    .map(([points, needed]) => ({ points: Number(points), needed }))
    .sort((left, right) => left.points - right.points);
  for (const step of table) {
    const below = go(entry, { ...entry.suite, casesPerArm: step.needed - 1 });
    const at = go(entry, { ...entry.suite, casesPerArm: step.needed });
    assert.notEqual(at.detectablePoints, null, `${step.needed} cases detected nothing`);
    assert.ok((at.detectablePoints as number) <= step.points, `${step.needed} cases claimed too much`);
    if (below.detectablePoints !== null) {
      assert.ok((below.detectablePoints as number) > (at.detectablePoints as number), 'more cases detected less');
    }
  }
  assert.equal(go(entry, { ...entry.suite, casesPerArm: 20 }).detectablePoints, null, '20 cases detected something');
});

test('a judged criterion may only gate on an effect the set can see', () => {
  const entry = findCase<Case>(fixture, 'a-set-sized-for-the-regression-that-matters-is-sound');
  const outcome = go(entry);
  const detectable = outcome.detectablePoints as number;
  for (const drop of [detectable - 1, detectable, detectable + 1]) {
    const probe = go(entry, { ...entry.suite, criteria: [{ name: 'probe', kind: 'judged', gated: true, observedDropPoints: drop }] });
    assert.equal(probe.status === 'unsound', drop < detectable, `a ${drop}-point gate at a ${detectable}-point floor`);
    assert.equal(probe.gated.includes('probe'), drop >= detectable, `a ${drop}-point gate was listed wrongly`);
  }
});

test('a deterministic criterion gates at any set size, and a judged one does not', () => {
  const entry = findCase<Case>(fixture, 'twenty-cases-cannot-gate-anything-judged');
  for (const size of [1, 20, 90, 8400]) {
    const deterministic = go(entry, {
      ...entry.suite,
      casesPerArm: size,
      criteria: [{ name: 'citation', kind: 'deterministic', gated: true, observedDropPoints: 1 }],
    });
    assert.equal(deterministic.status, 'sound', `a deterministic gate was refused at ${size} cases`);
    assert.deepEqual(deterministic.gated, ['citation'], `a deterministic gate was dropped at ${size}`);
  }
});

test('every criterion is either gated or reported, never both and never lost', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    const seen = [...outcome.gated, ...outcome.reported];
    assert.equal(new Set(seen).size, seen.length, `${entry.id}: a criterion was gated and reported`);
    for (const name of seen) {
      assert.ok(entry.suite.criteria.some((item) => item.name === name), `${entry.id}: invented ${name}`);
    }
    const refused = entry.suite.criteria.filter((item) => !seen.includes(item.name));
    for (const item of refused) {
      assert.ok(
        outcome.errors.some((error) => error.startsWith(item.name)),
        `${entry.id}: ${item.name} vanished without a reason`,
      );
    }
  }
});

test('an ungated criterion is reported and never refused', () => {
  const entry = findCase<Case>(fixture, 'an-ungated-criterion-is-reported-rather-than-refused');
  const outcome = go(entry);
  assert.equal(outcome.status, 'sound', 'reporting an undetectable effect was refused');
  const ungated = entry.suite.criteria.filter((item) => !item.gated).map((item) => item.name);
  assert.deepEqual(outcome.reported, ungated, 'an ungated criterion was not reported');
  for (const name of ungated) assert.ok(!outcome.gated.includes(name), `${name} was gated anyway`);
});

test('the flake budget is spent per judged gate and is a hard limit', () => {
  const entry = findCase<Case>(fixture, 'a-set-sized-for-the-regression-that-matters-is-sound');
  const { falseAlarmBps, flakeBudgetBps } = entry.policy;
  for (const count of [1, 2, 3, 4, 6]) {
    const criteria = Array.from({ length: count }, (_, index) => ({
      name: `rubric_${index}`,
      kind: 'judged' as const,
      gated: true,
      observedDropPoints: 20,
    }));
    const outcome = go(entry, { ...entry.suite, criteria });
    assert.equal(outcome.expectedFalseAlarmsBps, count * falseAlarmBps, `${count} gates`);
    assert.equal(
      outcome.errors.some((error) => error.includes('bps against a budget')),
      count * falseAlarmBps > flakeBudgetBps,
      `${count} judged gates against a budget of ${flakeBudgetBps}`,
    );
  }
});

test('deterministic gates cost nothing against the flake budget', () => {
  const entry = findCase<Case>(fixture, 'a-set-sized-for-the-regression-that-matters-is-sound');
  const criteria = Array.from({ length: 60 }, (_, index) => ({
    name: `check_${index}`,
    kind: 'deterministic' as const,
    gated: true,
    observedDropPoints: 1,
  }));
  const outcome = go(entry, { ...entry.suite, criteria });
  assert.equal(outcome.expectedFalseAlarmsBps, 0, 'deterministic gates spent the flake budget');
  assert.equal(outcome.status, 'sound', 'sixty deterministic gates were refused');
  assert.equal(outcome.gated.length, 60, 'a deterministic gate was dropped');
});

test('the two questions demand different configurations', () => {
  const entry = findCase<Case>(fixture, 'a-set-sized-for-the-regression-that-matters-is-sound');
  for (const configuration of ['tightest', 'production'] as const) {
    const change = go(entry, { ...entry.suite, configuration }, 'did-it-change');
    assert.equal(change.status === 'unsound', configuration !== 'tightest', `did-it-change on ${configuration}`);
    const quality = go(entry, { ...entry.suite, configuration, seeds: 5 }, 'how-good-is-it');
    assert.equal(quality.status === 'unsound', configuration !== 'production', `how-good on ${configuration}`);
  }
});

test('a quality claim from a single seed is refused', () => {
  const entry = findCase<Case>(fixture, 'the-quality-question-answered-properly');
  for (const seeds of [1, 2, 5]) {
    const outcome = go(entry, { ...entry.suite, seeds }, 'how-good-is-it');
    assert.equal(outcome.status === 'unsound', seeds < 2, `${seeds} seeds for a quality claim`);
  }
  const change = go(entry, { ...entry.suite, seeds: 1, configuration: 'tightest' }, 'did-it-change');
  assert.equal(change.status, 'sound', 'did-it-change was made to pay for seeds it does not need');
});

test('the re-run policy must be declared before the run, whichever it is', () => {
  const entry = findCase<Case>(fixture, 'a-set-sized-for-the-regression-that-matters-is-sound');
  for (const rerunPolicy of ['declared-best-of-three', 'declared-single', 'undeclared'] as const) {
    const outcome = go(entry, { ...entry.suite, rerunPolicy });
    assert.equal(outcome.status === 'unsound', rerunPolicy === 'undeclared', rerunPolicy);
  }
});
