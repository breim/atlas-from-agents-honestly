import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Limits, Run, Spec, State, execute as Execute } from './start.ts';

interface Case {
  id: string;
  spec: string;
  limits?: Limits;
  input: State;
  updates: Record<string, State[]>;
  result: Run;
}

interface Fixture {
  chapter: string;
  limits: Limits;
  specs: Record<string, Spec>;
  cases: Case[];
}

const fixture = expected<Fixture>(import.meta.url);
const { execute } = await loadImpl<{ execute: typeof Execute }>(import.meta.url);

const specOf = (entry: Case) => fixture.specs[entry.spec];
const limitsOf = (entry: Case) => entry.limits ?? fixture.limits;
const go = (entry: Case, spec = specOf(entry), input = entry.input, updates = entry.updates) =>
  execute(spec, input, updates, limitsOf(entry));

const cases: Array<[string, string]> = [
  ['the-whole-agent-loop-is-one-self-edge', 'every prebuilt ReAct agent, drawn'],
  ['atlas-as-a-state-machine', 'six nodes, four of them without a model'],
  ['an-escalation-still-ends-at-finalize', 'the outcome union, enforced structurally'],
  ['a-node-returns-an-update-not-a-new-state', 'a field nobody touched survives'],
  ['the-cycle-is-bounded-by-a-function-of-state', 'the step cap, relocated somewhere testable'],
  ['an-edge-to-a-node-that-does-not-exist-is-caught', 'caught by compile, not by a customer'],
  ['an-unreachable-node-is-caught-before-anything-runs', 'a node nothing can reach'],
  ['a-node-with-no-path-to-end-is-caught-before-anything-runs', 'a run that could never finish'],
  ['a-cycle-that-never-satisfies-its-condition-halts', 'bounded even when the predicate is not'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(go(entry), entry.result);
  });
}

test('an invalid graph runs nothing at all', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    if (outcome.status !== 'invalid') continue;
    assert.deepEqual(outcome.path, [], `${entry.id}: an invalid graph executed a node`);
    assert.deepEqual(outcome.state, entry.input, `${entry.id}: an invalid graph changed state`);
    assert.equal(outcome.position, specOf(entry).entry, `${entry.id}: position moved before validation passed`);
    assert.ok(outcome.errors.length > 0, entry.id);
  }
});

test('a valid graph reports no errors, and an invalid one runs no steps', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    assert.equal(outcome.errors.length === 0, outcome.status !== 'invalid', `${entry.id}: errors disagree with status`);
  }
});

test('the path starts at the entry and every step follows a declared edge', () => {
  for (const entry of fixture.cases) {
    const spec = specOf(entry);
    const outcome = go(entry);
    if (outcome.status === 'invalid') continue;
    assert.equal(outcome.path[0], spec.entry, `${entry.id}: the run did not start at the entry`);

    const allowed = (from: string) => {
      const conditional = spec.conditionalEdges.find((edge) => edge.from === from);
      if (conditional) return [...conditional.branches.map((branch) => branch.to), conditional.otherwise];
      const edge = spec.edges.find((item) => item.from === from);
      return edge ? [edge.to] : ['END'];
    };

    for (let index = 1; index < outcome.path.length; index += 1) {
      assert.ok(
        allowed(outcome.path[index - 1]).includes(outcome.path[index]),
        `${entry.id}: ${outcome.path[index - 1]} -> ${outcome.path[index]} is not a declared edge`,
      );
    }
    if (outcome.status === 'completed') {
      assert.ok(allowed(outcome.path.at(-1) as string).includes('END'), `${entry.id}: the run left by an undeclared edge`);
    }
  }
});

test('every node the run visited exists in the graph', () => {
  for (const entry of fixture.cases) {
    const names = new Set(specOf(entry).nodes.map((node) => node.name));
    for (const visited of go(entry).path) {
      assert.ok(names.has(visited), `${entry.id}: visited ${visited}, which is not a node`);
    }
  }
});

test('a completed run is at END and a halted run is still standing on a node', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    const names = specOf(entry).nodes.map((node) => node.name);
    if (outcome.status === 'completed') assert.equal(outcome.position, 'END', entry.id);
    if (outcome.status === 'halted') {
      assert.ok(names.includes(outcome.position), `${entry.id}: halted nowhere`);
      assert.equal(outcome.path.length, limitsOf(entry).maxSteps, `${entry.id}: halted early`);
    }
  }
});

test('no run ever exceeds the step limit', () => {
  for (const entry of fixture.cases) {
    assert.ok(
      go(entry).path.length <= limitsOf(entry).maxSteps,
      `${entry.id}: ran past the bound`,
    );
  }
});

test('every path through the Atlas graph ends at finalize', () => {
  for (const entry of fixture.cases) {
    if (entry.spec !== 'atlas') continue;
    const outcome = go(entry);
    assert.equal(outcome.status, 'completed', `${entry.id}: an Atlas run did not finish`);
    assert.equal(outcome.path.at(-1), 'finalize', `${entry.id}: a run left without logging`);
  }
});

test('nothing a node did not touch is ever lost', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    if (outcome.status === 'invalid') continue;
    const written = new Set(Object.values(entry.updates).flatMap((list) => list.flatMap((update) => Object.keys(update))));
    for (const [field, value] of Object.entries(entry.input)) {
      if (written.has(field)) continue;
      assert.deepEqual(outcome.state[field], value, `${entry.id}: ${field} was dropped by a node`);
    }
  }
});

test('every field an applied update wrote is present in the final state', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    if (outcome.status === 'invalid') continue;
    for (const [name, list] of Object.entries(entry.updates)) {
      const applied = outcome.path.filter((visited) => visited === name).length;
      for (const update of list.slice(0, applied)) {
        for (const field of Object.keys(update)) {
          assert.ok(field in outcome.state, `${entry.id}: ${name} wrote ${field} and it is gone`);
        }
      }
    }
  }
});

test('an update a node never reached is never applied', () => {
  const entry = findCase<Case>(fixture, 'the-cycle-is-bounded-by-a-function-of-state');
  const unused = { ...entry.updates, gather: [...entry.updates.gather, { pending: 99, neverRan: true }] };
  const outcome = go(entry, specOf(entry), entry.input, unused);
  assert.ok(!('neverRan' in outcome.state), 'an update was applied by a visit that never happened');
  assert.deepEqual(outcome.path, entry.result.path, 'a spare update changed the route');
});

test('routing reads state, so changing state changes the route', () => {
  const entry = findCase<Case>(fixture, 'atlas-as-a-state-machine');
  const escalating = { ...entry.updates, triage: [{ category: 'human_only', urgency: 'high', pending: 0 }] };
  const outcome = go(entry, specOf(entry), entry.input, escalating);
  assert.deepEqual(outcome.path.slice(0, 2), ['triage', 'escalate'], 'the edge ignored the state it was given');
  assert.ok(!outcome.path.includes('gather'), 'a human-only ticket still gathered');
});

test('the same graph and the same updates always produce the same path', () => {
  for (const entry of fixture.cases) {
    const first = go(entry);
    const second = go(entry);
    assert.deepEqual(second, first, `${entry.id}: the run was not deterministic`);
  }
});

test('validation is structural, so it does not depend on the run at all', () => {
  const invalid = fixture.cases.filter((entry) => entry.result.status === 'invalid');
  assert.ok(invalid.length > 0, 'the fixture no longer has an invalid graph');
  for (const entry of invalid) {
    const noisy = go(entry, specOf(entry), { anything: true }, { a: [{ b: 1 }], b: [{ c: 2 }] });
    assert.deepEqual(noisy.errors, entry.result.errors, `${entry.id}: validation depended on the input`);
    assert.deepEqual(noisy.path, [], `${entry.id}: an invalid graph ran anyway`);
  }
});
