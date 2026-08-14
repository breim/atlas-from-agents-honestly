import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Graph, Ontology, Validation, validate as Validate } from './start.ts';

interface Case {
  id: string;
  graph: Graph;
  result: Validation;
}

const fixture = expected<{ chapter: string; ontology: Ontology; cases: Case[] }>(import.meta.url);
const { validate } = await loadImpl<{ validate: typeof Validate }>(import.meta.url);

const run = (entry: Case) => validate(entry.graph, fixture.ontology);

const cases: Array<[string, string]> = [
  ['a-conforming-graph-validates', 'a well-formed graph passes'],
  ['an-unknown-node-type-is-rejected', 'the ontology decides what a node may be'],
  ['a-duplicate-node-id-is-rejected', 'two nodes cannot share an id'],
  ['an-unknown-edge-type-is-rejected', 'the ontology decides what a relation may be'],
  ['an-edge-to-a-missing-node-is-rejected', 'an edge to nothing is not an edge'],
  ['an-edge-from-the-wrong-type-is-rejected', 'an Order cannot place an Order'],
  ['an-edge-to-the-wrong-type-is-rejected', 'a Customer cannot place a Product'],
  ['every-violation-is-reported-not-just-the-first', 'one pass reports every problem'],
  ['an-empty-graph-validates', 'an empty graph conforms'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('valid and errors always agree', () => {
  for (const entry of fixture.cases) {
    const { valid, errors } = run(entry);
    assert.equal(valid, errors.length === 0, `${entry.id}: verdict disagrees with errors`);
  }
});

test('every edge in a valid graph respects its declared domain and range', () => {
  for (const entry of fixture.cases) {
    if (!run(entry).valid) continue;
    const typeOf = new Map(entry.graph.nodes.map((node) => [node.id, node.type]));
    for (const edge of entry.graph.edges) {
      const declared = fixture.ontology.edgeTypes.find((e) => e.name === edge.type)!;
      assert.equal(typeOf.get(edge.from), declared.from, `${entry.id}: bad domain`);
      assert.equal(typeOf.get(edge.to), declared.to, `${entry.id}: bad range`);
    }
  }
});

test('an isolated node is not an error', () => {
  for (const entry of fixture.cases) {
    if (!run(entry).valid) continue;
    const lonely: Graph = {
      nodes: [...entry.graph.nodes, { id: 'lonely-order', type: 'Order' }],
      edges: entry.graph.edges,
    };
    assert.deepEqual(
      validate(lonely, fixture.ontology),
      { valid: true, errors: [] },
      `${entry.id}: an unconnected node was rejected`,
    );
  }
});

test('every error names something in the graph', () => {
  for (const entry of fixture.cases) {
    const names = new Set([
      ...entry.graph.nodes.map((node) => node.id),
      ...entry.graph.edges.flatMap((edge) => [edge.type, edge.from, edge.to]),
    ]);
    for (const error of run(entry).errors) {
      assert.ok(names.has(error.split(':')[1]), `${entry.id}: ${error} names nothing`);
    }
  }
});
