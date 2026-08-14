import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Edge, GraphNode, traverse as Traverse } from './start.ts';

interface Case {
  id: string;
  start: string;
  maxHops: number;
  visited: string[];
}

const fixture = expected<{
  chapter: string;
  tenantId: string;
  nodes: GraphNode[];
  edges: Edge[];
  cases: Case[];
}>(import.meta.url);
const { traverse } = await loadImpl<{ traverse: typeof Traverse }>(import.meta.url);

const run = (entry: Case) =>
  traverse(entry.start, fixture.nodes, fixture.edges, entry.maxHops, fixture.tenantId);

const cases: Array<[string, string]> = [
  ['zero-hops-is-just-the-start', 'a budget of zero visits only the start'],
  ['one-hop-finds-the-direct-neighbours', 'one hop reaches the neighbours'],
  ['two-hops-goes-one-further', 'two hops reaches their neighbours'],
  ['a-cycle-terminates', 'a loop does not revisit'],
  ['a-node-behind-another-tenant-is-unreachable', 'the walk stops at the boundary'],
  ['another-tenants-node-is-never-visited', "a foreign node is not in anyone's results"],
  ['starting-outside-the-tenant-returns-nothing', 'the start gets the same check as everything'],
  ['an-unknown-start-returns-nothing', 'a start that does not exist visits nothing'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.visited);
  });
}

test('no node from another tenant is ever visited', () => {
  const foreign = new Set(
    fixture.nodes.filter((node) => node.tenantId !== fixture.tenantId).map((node) => node.id),
  );
  for (const entry of fixture.cases) {
    for (const id of run(entry)) {
      assert.ok(!foreign.has(id), `${entry.id}: visited ${id}, which belongs to another tenant`);
    }
  }
});

test('no node is visited twice', () => {
  for (const entry of fixture.cases) {
    const visited = run(entry);
    assert.equal(new Set(visited).size, visited.length, `${entry.id}: revisited a node`);
  }
});

test('every visited node is reachable within the hop budget through visible nodes', () => {
  const visible = new Set(
    fixture.nodes.filter((node) => node.tenantId === fixture.tenantId).map((node) => node.id),
  );
  for (const entry of fixture.cases) {
    let frontier = new Set([entry.start].filter((id) => visible.has(id)));
    const reachable = new Set(frontier);
    for (let hop = 0; hop < entry.maxHops; hop += 1) {
      const next = new Set<string>();
      for (const edge of fixture.edges) {
        if (frontier.has(edge.from) && visible.has(edge.to) && !reachable.has(edge.to)) {
          next.add(edge.to);
          reachable.add(edge.to);
        }
      }
      frontier = next;
    }
    for (const id of run(entry)) {
      assert.ok(reachable.has(id), `${entry.id}: ${id} is not reachable inside the budget`);
    }
  }
});

test('a bigger budget never visits fewer nodes', () => {
  for (const entry of fixture.cases) {
    const further = traverse(
      entry.start,
      fixture.nodes,
      fixture.edges,
      entry.maxHops + 1,
      fixture.tenantId,
    );
    assert.ok(further.length >= run(entry).length, `${entry.id}: more hops visited less`);
  }
});
