import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Mechanism, Program, Step, Trace, run as Run } from './start.ts';

interface Case {
  id: string;
  program: string;
  mechanism: Mechanism;
  result: Trace;
}

interface Fixture {
  chapter: string;
  programs: Record<string, Program>;
  cases: Case[];
}

const fixture = expected<Fixture>(import.meta.url);
const { run } = await loadImpl<{ run: typeof Run }>(import.meta.url);

const programs = Object.values(fixture.programs);
const flatten = (steps: Step[]): Array<{ kind: string; name: string }> =>
  steps.flatMap((step) => (step.kind === 'subgraph' ? flatten(step.steps) : [step]));
const pauses = (program: Program) => flatten(program.steps).filter((leaf) => leaf.kind === 'interrupt').length;
const distinct = (trace: Trace) => [...new Set(trace.effects)];

const cases: Array<[string, string]> = [
  ['langgraph-re-runs-an-effect-above-the-interrupt', 'the credit is issued twice'],
  ['temporal-re-runs-nothing-above-the-pause', 'the journalled credit is not re-issued'],
  ['langgraph-runs-an-effect-below-the-interrupt-once', 'the rule, working'],
  ['temporal-runs-the-safe-node-the-same-way', 'the safe shape is safe under both'],
  ['langgraph-re-runs-a-two-interrupt-node-twice-over', 'two decisions, three executions'],
  ['temporal-takes-two-decisions-without-repeating-anything', 'two pauses cost nothing'],
  ['langgraph-re-runs-the-parent-of-a-subgraph-too', 'no interrupt in sight to warn you'],
  ['temporal-leaves-the-parent-alone', 'the parent never notices'],
  ['a-node-that-never-pauses-runs-once-under-langgraph', 'no pause, no repeat'],
  ['a-node-that-never-pauses-runs-once-under-temporal', 'the same, from the other side'],
  ['an-empty-node-has-nothing-to-repeat', 'nothing twice is still nothing'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(run(fixture.programs[entry.program], entry.mechanism), entry.result);
  });
}

test('temporal never repeats an effect and never re-executes', () => {
  for (const [name, program] of Object.entries(fixture.programs)) {
    const trace = run(program, 'temporal');
    assert.deepEqual(trace.duplicated, [], `${name}: a journalled effect ran again`);
    assert.equal(trace.executions, 1, `${name}: the workflow restarted`);
  }
});

test('both mechanisms do the same work, once the dust settles', () => {
  for (const [name, program] of Object.entries(fixture.programs)) {
    assert.deepEqual(
      distinct(run(program, 'langgraph')),
      distinct(run(program, 'temporal')),
      `${name}: the mechanisms disagree about what the node does`,
    );
  }
});

test('an effect below every interrupt is never repeated, under either mechanism', () => {
  for (const [name, program] of Object.entries(fixture.programs)) {
    const leaves = flatten(program.steps);
    const last = leaves.map((leaf) => leaf.kind).lastIndexOf('interrupt');
    const safe = leaves.slice(last + 1).filter((leaf) => leaf.kind === 'effect').map((leaf) => leaf.name);
    for (const mechanism of ['langgraph', 'temporal'] as const) {
      const { effects } = run(program, mechanism);
      for (const effect of safe) {
        const times = effects.filter((emitted) => emitted === effect).length;
        assert.equal(times, 1, `${name}/${mechanism}: ${effect} ran ${times} times below the last interrupt`);
      }
    }
  }
});

test('under langgraph an effect runs once per interrupt still ahead of it, plus one', () => {
  for (const [name, program] of Object.entries(fixture.programs)) {
    const leaves = flatten(program.steps);
    const { effects } = run(program, 'langgraph');
    leaves.forEach((leaf, index) => {
      if (leaf.kind !== 'effect') return;
      const ahead = leaves.slice(index).filter((later) => later.kind === 'interrupt').length;
      const times = effects.filter((emitted) => emitted === leaf.name).length;
      assert.equal(times, ahead + 1, `${name}: ${leaf.name} ran ${times} times, not ${ahead + 1}`);
    });
  }
});

test('langgraph executes the node once per pause plus once; temporal once', () => {
  for (const [name, program] of Object.entries(fixture.programs)) {
    assert.equal(run(program, 'langgraph').executions, pauses(program) + 1, name);
    assert.equal(run(program, 'temporal').executions, 1, name);
  }
});

test('moving every effect below the interrupts removes the repetition', () => {
  for (const [name, program] of Object.entries(fixture.programs)) {
    const leaves = flatten(program.steps);
    const reordered: Program = {
      steps: [
        ...leaves.filter((leaf) => leaf.kind === 'interrupt'),
        ...leaves.filter((leaf) => leaf.kind === 'effect'),
      ] as Step[],
    };
    assert.deepEqual(run(reordered, 'langgraph').duplicated, [], `${name}: reordering did not help`);
  }
});

test('wrapping a node in a subgraph changes nothing at all', () => {
  for (const [name, program] of Object.entries(fixture.programs)) {
    const wrapped: Program = { steps: [{ kind: 'subgraph', name: 'wrapper', steps: program.steps }] };
    for (const mechanism of ['langgraph', 'temporal'] as const) {
      assert.deepEqual(
        run(wrapped, mechanism),
        run(program, mechanism),
        `${name}/${mechanism}: the subgraph boundary protected something`,
      );
    }
  }
});

test('every case is covered by a program the fixture declares', () => {
  for (const entry of fixture.cases) {
    assert.ok(fixture.programs[entry.program], `${entry.id}: unknown program ${entry.program}`);
  }
  assert.ok(programs.length > 0);
});
