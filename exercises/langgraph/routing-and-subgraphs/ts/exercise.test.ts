import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Config, Graph, Run, State, run as RunFn } from './start.ts';

interface Case {
  id: string;
  graph: string;
  mode?: 'shared' | 'transformed';
  backstop?: number;
  input: State;
  updates: Record<string, State[]>;
  subUpdates: Record<string, State[]>;
  result: Run;
}

interface Fixture {
  chapter: string;
  config: Config;
  graphs: Record<string, Graph>;
  cases: Case[];
}

const fixture = expected<Fixture>(import.meta.url);
const { run } = await loadImpl<{ run: typeof RunFn }>(import.meta.url);

const graphOf = (entry: Case): Graph => {
  const graph = fixture.graphs[entry.graph];
  if (!entry.mode) return graph;
  return {
    ...graph,
    nodes: graph.nodes.map((node) => (node.kind === 'subgraph' ? { ...node, mode: entry.mode } : node)),
  };
};

const configOf = (entry: Case) => (entry.backstop ? { ...fixture.config, backstop: entry.backstop } : fixture.config);

const go = (entry: Case, graph = graphOf(entry), config = configOf(entry), updates = entry.updates) =>
  run(graph, entry.input, updates, entry.subUpdates, config);

const cases: Array<[string, string]> = [
  ['the-semantic-bound-produces-a-result-not-an-exception', 'halted is an outcome'],
  ['a-loop-you-did-not-bound-hits-the-backstop-and-that-is-an-exception', 'a stack trace, not a result'],
  ['a-transformed-subgraph-sees-only-what-was-passed', 'isolation with a type signature'],
  ['a-shared-subgraph-sees-everything-including-what-it-should-not', 'convenient and coupled'],
  ['fan-out-runs-every-branch-and-merges-through-reducers', 'sectioning, as a graph'],
  ['a-router-may-only-return-a-destination-it-declared', 'a graph nobody can draw'],
  ['a-router-that-reads-the-transcript-is-rejected', 'decision state and nothing else'],
  ['a-backstop-below-the-semantic-bound-inverts-the-arrangement', 'the last resort, firing first'],
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
    assert.equal(outcome.superSteps, 0, `${entry.id}: an invalid graph consumed super-steps`);
    assert.deepEqual(outcome.state, entry.input, `${entry.id}: an invalid graph changed state`);
    assert.ok(outcome.errors.length > 0, entry.id);
  }
});

test('every router destination taken was declared in advance', () => {
  for (const entry of fixture.cases) {
    const graph = graphOf(entry);
    const outcome = go(entry);
    if (outcome.status === 'invalid') continue;
    outcome.path.forEach((visited, index) => {
      const router = graph.routers.find((item) => item.from === visited);
      const next = outcome.path[index + 1];
      if (!router || !next) return;
      const declared = router.destinations;
      if (router.fanOut) {
        assert.ok(declared.includes(next), `${entry.id}: fan-out reached undeclared ${next}`);
        return;
      }
      assert.ok(declared.includes(next), `${entry.id}: router at ${visited} reached undeclared ${next}`);
    });
  }
});

test('a router naming a destination it did not declare is always rejected', () => {
  for (const [name, graph] of Object.entries(fixture.graphs)) {
    const undeclared = graph.routers.flatMap((router) =>
      [
        ...router.branches.map((branch) => branch.to),
        ...(router.otherwise ? [router.otherwise] : []),
        ...(router.fanOut ?? []),
      ].filter((target) => !router.destinations.includes(target)),
    );
    if (undeclared.length === 0) continue;
    const outcome = run(graph, {}, {}, {}, fixture.config);
    assert.equal(outcome.status, 'invalid', `${name}: an undeclared destination was accepted`);
    for (const target of undeclared) {
      assert.ok(
        outcome.errors.some((error) => error.includes(target)),
        `${name}: ${target} was accepted without complaint`,
      );
    }
  }
});

test('a graph whose backstop undercuts its own bound is always rejected', () => {
  for (const [name, graph] of Object.entries(fixture.graphs)) {
    if (!graph.loop) continue;
    const owed = graph.loop.bound * graph.loop.superStepsPerPass;
    for (const backstop of [owed - 1, owed, owed + 1]) {
      const outcome = run(graph, {}, {}, {}, { ...fixture.config, backstop });
      assert.equal(
        outcome.status === 'invalid' && outcome.errors.some((error) => error.includes('backstop')),
        backstop <= owed,
        `${name}: backstop ${backstop} against a bound of ${owed} was judged wrongly`,
      );
    }
  }
});

test('no router anywhere in the fixture reads transcript state', () => {
  for (const [name, graph] of Object.entries(fixture.graphs)) {
    const reads = graph.routers.flatMap((router) => router.branches.map((branch) => branch.when.field));
    const offending = reads.filter((field) => fixture.config.transcriptFields.includes(field));
    const rejected = run(graph, {}, {}, {}, fixture.config).status === 'invalid';
    assert.equal(offending.length > 0, rejected && offending.length > 0, `${name}: transcript reads were not rejected`);
    if (offending.length > 0) assert.equal(rejected, true, `${name}: a transcript-reading router was accepted`);
  }
});

test('a halted run is a result and a backstopped run is an error', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    if (outcome.status === 'halted') {
      assert.deepEqual(outcome.errors, [], `${entry.id}: a halt reported an error`);
      assert.equal(outcome.path.at(-1), 'halt', `${entry.id}: halted somewhere that is not the halt node`);
    }
    if (outcome.status === 'crashed') {
      assert.ok(outcome.errors.length > 0, `${entry.id}: a backstop fired silently`);
      assert.equal(outcome.superSteps, configOf(entry).backstop, `${entry.id}: the backstop fired early or late`);
    }
  }
});

test('the semantic bound stops the run before the backstop ever sees it', () => {
  const entry = findCase<Case>(fixture, 'the-semantic-bound-produces-a-result-not-an-exception');
  const outcome = go(entry);
  assert.equal(outcome.status, 'halted');
  assert.ok(outcome.superSteps < configOf(entry).backstop, 'the bound did not fire first');
  const loop = graphOf(entry).loop!;
  assert.ok(loop.bound * loop.superStepsPerPass < fixture.config.backstop, 'the fixture no longer orders the bounds');
});

test('removing the semantic bound turns a result into an exception', () => {
  const bounded = findCase<Case>(fixture, 'the-semantic-bound-produces-a-result-not-an-exception');
  const graph = graphOf(bounded);
  const unbounded: Graph = {
    ...graph,
    loop: null,
    routers: graph.routers.map((router) => ({
      ...router,
      branches: router.branches.filter((branch) => branch.to !== 'halt'),
    })),
  };
  const outcome = run(unbounded, bounded.input, bounded.updates, bounded.subUpdates, { ...fixture.config, backstop: 8 });
  assert.equal(outcome.status, 'crashed', 'an unbounded loop still produced a result');
  assert.ok(outcome.errors.length > 0, 'an unbounded loop failed silently');
});

test('no run ever exceeds the backstop', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    assert.ok(outcome.superSteps <= configOf(entry).backstop, `${entry.id}: ran past the backstop`);
    assert.equal(outcome.superSteps, outcome.path.length, `${entry.id}: super-steps disagree with the path`);
  }
});

test('a transformed subgraph sees exactly what it was passed and nothing more', () => {
  for (const entry of fixture.cases) {
    const graph = graphOf(entry);
    for (const view of go(entry).views) {
      const node = graph.nodes.find((item) => item.name === view.node)!;
      if (node.mode !== 'transformed') continue;
      assert.deepEqual(view.saw, [...(node.passes ?? [])].sort(), `${entry.id}: ${view.node} saw the wrong fields`);
      for (const field of fixture.config.transcriptFields) {
        assert.ok(!view.saw.includes(field), `${entry.id}: ${view.node} was handed the transcript`);
      }
    }
  }
});

test('a transformed subgraph returns only the fields it declared', () => {
  const entry = findCase<Case>(fixture, 'a-transformed-subgraph-sees-only-what-was-passed');
  const graph = graphOf(entry);
  const node = graph.nodes.find((item) => item.kind === 'subgraph')!;
  const outcome = go(entry);
  const written = Object.keys(entry.subUpdates[node.graph as string][0]);
  const withheld = written.filter((field) => !(node.returns ?? []).includes(field));
  assert.ok(withheld.length > 0, 'the fixture no longer has the subgraph writing anything private');
  for (const field of withheld) {
    assert.ok(!(field in outcome.state), `${field} escaped a transformed subgraph`);
  }
  for (const field of node.returns ?? []) {
    assert.ok(field in outcome.state, `${field} was declared and never returned`);
  }
});

test('shared mode leaks exactly what transformed mode withholds', () => {
  const entry = findCase<Case>(fixture, 'a-transformed-subgraph-sees-only-what-was-passed');
  const transformed = go(entry, graphOf(entry));
  const shared = go(entry, {
    ...fixture.graphs[entry.graph],
    nodes: fixture.graphs[entry.graph].nodes.map((node) =>
      node.kind === 'subgraph' ? { ...node, mode: 'shared' as const } : node,
    ),
  });
  assert.ok(
    shared.views[0].saw.length > transformed.views[0].saw.length,
    'shared mode did not see more than transformed mode',
  );
  assert.ok(
    Object.keys(shared.state).length > Object.keys(transformed.state).length,
    'shared mode did not return more than transformed mode',
  );
  assert.deepEqual(shared.path, transformed.path, 'the wiring mode changed the route');
});

test('fan-out runs every declared branch exactly once', () => {
  const entry = findCase<Case>(fixture, 'fan-out-runs-every-branch-and-merges-through-reducers');
  const router = graphOf(entry).routers.find((item) => item.fanOut)!;
  const outcome = go(entry);
  for (const branch of router.fanOut as string[]) {
    assert.equal(
      outcome.path.filter((visited) => visited === branch).length,
      1,
      `${branch} did not run exactly once`,
    );
  }
  assert.equal(outcome.path.at(-1), router.join, 'the run did not continue from the join');
});

test('a commutative reducer survives reordering and concatenation does not', () => {
  const entry = findCase<Case>(fixture, 'fan-out-runs-every-branch-and-merges-through-reducers');
  const graph = graphOf(entry);
  const reversed: Graph = {
    ...graph,
    routers: graph.routers.map((router) =>
      router.fanOut ? { ...router, fanOut: [...router.fanOut].reverse() } : router,
    ),
  };
  const forward = go(entry, graph);
  const backward = go(entry, reversed);

  assert.equal(backward.state.score, forward.state.score, 'sum is not commutative here');
  assert.deepEqual(
    [...(backward.state.findings as string[])].sort(),
    [...(forward.state.findings as string[])].sort(),
    'reordering lost a finding',
  );
  assert.notDeepEqual(
    backward.state.findings,
    forward.state.findings,
    'the fixture no longer shows concatenation depending on order',
  );
});
