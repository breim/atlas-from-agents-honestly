import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Graph, Report, Runtime, plan as PlanFn } from './start.ts';

interface Case { id: string; graph: Graph; runtime: Runtime; result: Report }
interface Fixture { chapter: string; cases: Case[] }

const fixture = expected<Fixture>(import.meta.url);
const { plan } = await loadImpl<{ plan: typeof PlanFn }>(import.meta.url);
const go = (entry: Case, graph = entry.graph, runtime = entry.runtime) => plan(graph, runtime);
const ACTIVITY_WORK = ['model', 'io', 'interrupt'];

const cases: Array<[string, string]> = [
  ['in-a-real-agent-graph-exactly-one-node-is-not-an-activity', 'the policy invariant'],
  ['a-node-with-no-execute-in-is-refused', 'the decision you cannot skip'],
  ['a-model-call-placed-in-the-workflow-is-refused', 'a model call cannot be replayed'],
  ['a-synchronous-conditional-edge-needs-porting', 'edges always run in the workflow'],
  ['the-store-is-unreachable-from-an-activity-node', 'it fails at the point of use'],
  ['an-interrupt-on-old-python-loads-with-a-warning-and-no-pause', 'silently not there'],
  ['the-same-graph-on-a-supported-python-warns-about-nothing', 'the version is the difference'],
  ['typescript-writes-the-workflow-by-hand', 'about forty lines'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(go(entry), entry.result);
  });
}

test('every node must declare where it runs, and none may be defaulted', () => {
  const entry = findCase<Case>(fixture, 'in-a-real-agent-graph-exactly-one-node-is-not-an-activity');
  for (const node of entry.graph.nodes) {
    const stripped = entry.graph.nodes.map((item) =>
      item.name === node.name ? { name: item.name, work: item.work } : item,
    );
    const outcome = go(entry, { ...entry.graph, nodes: stripped });
    assert.equal(outcome.status, 'rejected', `${node.name} was allowed to default`);
    assert.ok(outcome.errors.some((error) => error.includes(node.name)), `${node.name} refused silently`);
  }
});

test('anything that touches the world must be an activity, and pure work need not be', () => {
  for (const entry of fixture.cases) {
    if (entry.runtime.language !== 'python') continue;
    const outcome = go(entry);
    for (const node of entry.graph.nodes) {
      if (!node.executeIn || !ACTIVITY_WORK.includes(node.work)) continue;
      const misplaced = node.executeIn !== 'activity';
      assert.equal(
        outcome.errors.some((error) => error.startsWith(node.name) && error.includes('must execute in an activity')),
        misplaced,
        `${entry.id}: ${node.name} was judged wrongly`,
      );
    }
    for (const node of entry.graph.nodes) {
      if (ACTIVITY_WORK.includes(node.work) || node.executeIn !== 'workflow') continue;
      assert.ok(
        !outcome.errors.some((error) => error.startsWith(node.name)),
        `${entry.id}: pure work in the workflow was refused`,
      );
    }
  }
});

test('placing model work in the workflow is refused, every time', () => {
  const entry = findCase<Case>(fixture, 'in-a-real-agent-graph-exactly-one-node-is-not-an-activity');
  for (const work of ACTIVITY_WORK) {
    const outcome = go(entry, { nodes: [{ name: 'probe', work: work as never, executeIn: 'workflow' }], edges: [] });
    assert.equal(outcome.status, 'rejected', `${work} was allowed in the workflow`);
    const fine = go(entry, { nodes: [{ name: 'probe', work: work as never, executeIn: 'activity' }], edges: [] });
    assert.equal(fine.status, 'ready', `${work} was refused as an activity`);
  }
});

test('almost every node is an activity, and the one that is not is pure', () => {
  const entry = findCase<Case>(fixture, 'in-a-real-agent-graph-exactly-one-node-is-not-an-activity');
  const outcome = go(entry);
  assert.equal(outcome.workflowCount, 1, 'more than one node stayed in the workflow');
  assert.ok(outcome.activityCount > outcome.workflowCount, 'the graph is not activity-dominated');
  const stayed = outcome.placement.find((item) => item.executeIn === 'workflow')!;
  const node = entry.graph.nodes.find((item) => item.name === stayed.node)!;
  assert.ok(!ACTIVITY_WORK.includes(node.work), 'the node that stayed does effectful work');
});

test('the placement covers every node exactly once', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    if (outcome.status === 'unsupported') continue;
    const declared = entry.graph.nodes.filter((node) => node.executeIn).map((node) => node.name);
    assert.deepEqual(outcome.placement.map((item) => item.node), declared, `${entry.id}: placement mismatch`);
    assert.equal(outcome.activityCount + outcome.workflowCount, declared.length, `${entry.id}: counts`);
  }
});

test('a synchronous conditional edge is always refused', () => {
  for (const entry of fixture.cases) {
    if (entry.runtime.language !== 'python') continue;
    const outcome = go(entry);
    for (const edge of entry.graph.edges) {
      if (edge.async) continue;
      assert.ok(outcome.errors.some((error) => error.includes(edge.from)), `${entry.id}: a sync edge slipped`);
    }
  }
});

test('the store is refused in an activity and accepted in the workflow', () => {
  const entry = findCase<Case>(fixture, 'in-a-real-agent-graph-exactly-one-node-is-not-an-activity');
  const inActivity = go(entry, { nodes: [{ name: 'recall', work: 'io', executeIn: 'activity', usesStore: true }], edges: [] });
  assert.equal(inActivity.status, 'rejected', 'the store was reachable from an activity');
  const inWorkflow = go(entry, { nodes: [{ name: 'recall', work: 'pure', executeIn: 'workflow', usesStore: true }], edges: [] });
  assert.equal(inWorkflow.status, 'ready', 'the store was refused in workflow code');
});

test('an old python warns rather than failing, which is the hazard', () => {
  const entry = findCase<Case>(fixture, 'an-interrupt-on-old-python-loads-with-a-warning-and-no-pause');
  const outcome = go(entry);
  assert.equal(outcome.status, 'ready', 'an old python failed loudly, which would be safer');
  assert.ok(outcome.warnings.length > 0, 'the missing pause was not reported at all');
  const modern = go(entry, entry.graph, { ...entry.runtime, pythonVersion: '3.12' });
  assert.deepEqual(modern.warnings, [], 'a supported python still warned');
  assert.deepEqual(modern.placement, outcome.placement, 'the version changed the placement');
});

test('a graph with no interrupt and no functional api does not care about the version', () => {
  const entry = findCase<Case>(fixture, 'in-a-real-agent-graph-exactly-one-node-is-not-an-activity');
  for (const pythonVersion of ['3.9', '3.10', '3.11', '3.12']) {
    const outcome = go(entry, entry.graph, { ...entry.runtime, pythonVersion });
    assert.deepEqual(outcome.warnings, [], `${pythonVersion} warned about a graph that needs nothing`);
  }
  const functional = go(entry, entry.graph, { ...entry.runtime, pythonVersion: '3.10', usesFunctionalApi: true });
  assert.ok(functional.warnings.length > 0, 'the functional API on 3.10 was not flagged');
});

test('typescript is unsupported, and nothing is placed', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry, entry.graph, { ...entry.runtime, language: 'typescript' });
    assert.equal(outcome.status, 'unsupported', `${entry.id}: typescript was accepted`);
    assert.deepEqual(outcome.placement, [], `${entry.id}: typescript placed nodes`);
    assert.equal(outcome.checkpointer, 'none', `${entry.id}: typescript claimed a checkpointer`);
  }
});

test('temporal history replaces the checkpointer rather than complementing it', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    if (outcome.status === 'unsupported') continue;
    assert.equal(outcome.checkpointer, 'temporal-history', `${entry.id}: a second checkpointer survived`);
  }
});
