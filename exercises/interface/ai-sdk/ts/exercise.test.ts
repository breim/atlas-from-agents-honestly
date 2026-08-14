import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Policy, Runtime, Shape, Verdict, place as PlaceFn } from './start.ts';

interface Case { id: string; runtime: Runtime; shape: Shape['name']; policy: Policy; result: Verdict }
interface Fixture { chapter: string; policy: Policy; cases: Case[] }

const fixture = expected<Fixture>(import.meta.url);
const { place } = await loadImpl<{ place: typeof PlaceFn }>(import.meta.url);
const go = (entry: Case, runtime = entry.runtime, shape = entry.shape) => place(runtime, shape, entry.policy);

const cases: Array<[string, string]> = [
  ['one-loop-where-durability-lives-is-sound', 'one loop, one owner'],
  ['cost-and-deadline-are-still-yours', 'two conditions ship, two do not'],
  ['bounding-cost-and-deadline-yourself-silences-the-warning', 'you can still own them'],
  ['three-loops-are-three-step-counters-that-disagree', 'adopting all three'],
  ['the-loop-must-live-where-durability-lives', 'neither framework loop'],
  ['a-loop-with-no-stop-condition-runs-forever', 'now an API parameter'],
  ['a-loop-with-no-step-cap-is-unsound', 'the bound is not optional'],
  ['a-chat-cap-on-a-one-call-shape-is-warned', 'one for one-tool-then-answer'],
  ['an-autonomous-shape-affords-a-larger-cap', 'ten to twenty'],
  ['python-cannot-host-the-interface-layer', 'typescript-only'],
  ['the-deprecated-object-api-is-warned-not-refused', 'slated for removal, not gone'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(go(entry), entry.result);
  });
}

test('exactly one loop is sound, and none or several are not', () => {
  const entry = findCase<Case>(fixture, 'one-loop-where-durability-lives-is-sound');
  const one = entry.runtime.loops[0];
  for (const count of [0, 1, 2, 3]) {
    const loops = Array.from({ length: count }, () => one);
    const outcome = go(entry, { ...entry.runtime, loops });
    assert.equal(outcome.status === 'sound', count === 1, `${count} loops`);
    assert.equal(outcome.loopOwner, count === 1 ? one.owner : null, `${count} loops: owner`);
  }
});

test('the loop must live wherever durability lives', () => {
  const entry = findCase<Case>(fixture, 'one-loop-where-durability-lives-is-sound');
  const owners = ['ai-sdk', 'langgraph', 'workflow'] as const;
  for (const durabilityLives of owners) {
    for (const owner of owners) {
      const outcome = go(entry, {
        ...entry.runtime,
        durabilityLives,
        loops: [{ ...entry.runtime.loops[0], owner }],
      });
      assert.equal(outcome.status === 'sound', owner === durabilityLives, `${owner} vs ${durabilityLives}`);
    }
  }
});

test('with no durable backend, any single owner is acceptable', () => {
  const entry = findCase<Case>(fixture, 'one-loop-where-durability-lives-is-sound');
  for (const owner of ['ai-sdk', 'langgraph', 'workflow'] as const) {
    const outcome = go(entry, {
      ...entry.runtime,
      durabilityLives: 'none',
      loops: [{ ...entry.runtime.loops[0], owner }],
    });
    assert.equal(outcome.status, 'sound', `${owner} was refused with no durability anywhere`);
  }
});

test('a loop with no stop condition or no cap is unsound', () => {
  const entry = findCase<Case>(fixture, 'one-loop-where-durability-lives-is-sound');
  const bare = go(entry, { ...entry.runtime, loops: [{ ...entry.runtime.loops[0], stopConditions: [] }] });
  assert.equal(bare.status, 'unsound', 'an unbounded loop was accepted');
  const uncapped = go(entry, { ...entry.runtime, loops: [{ ...entry.runtime.loops[0], maxSteps: null }] });
  assert.equal(uncapped.status, 'unsound', 'a loop with no step cap was accepted');
});

test('only the first-party conditions are counted as owned by the SDK', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    for (const condition of outcome.boundsOwned) {
      assert.ok(
        entry.policy.firstPartyStopConditions.includes(condition),
        `${entry.id}: ${condition} was claimed as first-party`,
      );
    }
    assert.deepEqual(outcome.boundsYours, [...entry.policy.boundsYouOwn].sort(), `${entry.id}: bounds you own`);
  }
});

test('cost and deadline are warned about unless you bound them yourself', () => {
  const entry = findCase<Case>(fixture, 'one-loop-where-durability-lives-is-sound');
  for (const bound of entry.policy.boundsYouOwn) {
    const without = go(entry);
    assert.ok(
      without.warnings.some((warning) => warning.startsWith(bound)),
      `${bound} was not flagged as unbounded`,
    );
    const with_ = go(entry, {
      ...entry.runtime,
      loops: [{ ...entry.runtime.loops[0], stopConditions: [...entry.runtime.loops[0].stopConditions, bound] }],
    });
    assert.ok(!with_.warnings.some((warning) => warning.startsWith(bound)), `${bound} still warned once bounded`);
  }
});

test('a step cap does not stand in for a cost or deadline bound', () => {
  const entry = findCase<Case>(fixture, 'one-loop-where-durability-lives-is-sound');
  const outcome = go(entry, {
    ...entry.runtime,
    loops: [{ ...entry.runtime.loops[0], stopConditions: ['step-count'], maxSteps: 1 }],
  });
  assert.equal(outcome.warnings.filter((warning) => warning.includes('nothing here bounds it')).length, 2);
});

test('the step cap is judged against the shape it claims to be', () => {
  const entry = findCase<Case>(fixture, 'one-loop-where-durability-lives-is-sound');
  for (const shape of entry.policy.shapes) {
    for (const maxSteps of [shape.suggestedMaxSteps, shape.suggestedMaxSteps + 1]) {
      const outcome = go(entry, { ...entry.runtime, loops: [{ ...entry.runtime.loops[0], maxSteps }] }, shape.name);
      const owed = maxSteps > shape.suggestedMaxSteps;
      assert.equal(
        outcome.warnings.some((warning) => warning.includes(`${maxSteps} steps`)),
        owed,
        `${maxSteps} steps for a ${shape.name} shape`,
      );
    }
  }
});

test('an unsound runtime names no loop owner', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    assert.equal(outcome.loopOwner === null, outcome.status === 'unsound', `${entry.id}: owner vs status`);
    if (outcome.status === 'unsound') assert.ok(outcome.errors.length > 0, entry.id);
  }
});

test('python is refused for the interface layer and typescript is not', () => {
  const entry = findCase<Case>(fixture, 'one-loop-where-durability-lives-is-sound');
  for (const language of ['typescript', 'python'] as const) {
    const outcome = go(entry, { ...entry.runtime, language });
    assert.equal(outcome.status === 'unsound', language === 'python', language);
  }
});

test('the deprecated object API warns without failing the placement', () => {
  const entry = findCase<Case>(fixture, 'the-deprecated-object-api-is-warned-not-refused');
  const outcome = go(entry);
  assert.equal(outcome.status, 'sound', 'a deprecation was treated as a failure');
  assert.ok(outcome.warnings.some((warning) => warning.includes('deprecated')), 'the deprecation was silent');
  const modern = go(entry, { ...entry.runtime, usesDeprecatedObjectApi: false });
  assert.ok(!modern.warnings.some((warning) => warning.includes('deprecated')), 'the modern API still warned');
});
