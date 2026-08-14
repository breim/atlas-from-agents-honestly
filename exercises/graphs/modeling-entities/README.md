# Entities, Relations, and Ontology

**Tier:** drill. A self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part V · Knowledge Graphs · Entities, Relations, and Ontology](https://agentshonestly.com/book/graphs/modeling-entities)

The ontology is a schema. Check the graph against it before anything queries it.

## The task

Implement `validate(graph, ontology)`, returning `{ valid, errors }`.

Nodes need a declared type and a unique id. Edges need a declared type, endpoints that
exist, and endpoint types matching the edge's declared domain and range. Errors are
reported nodes-first then edges, in declaration order, each naming the offending id:
`unknown_node_type`, `duplicate_node`, `unknown_edge_type`, `missing_node`,
`domain_mismatch`, `range_mismatch`.

`an-edge-from-the-wrong-type-is-rejected` is the check that earns the ontology. Both
endpoints exist, both are legitimate nodes, the edge type is real, and one Order
`placed` another Order, which is meaningless. A graph store will happily accept it. The
query that walks `placed` edges to find a customer will then return an Order, and the
failure surfaces three hops away from the extraction that caused it.

`every-violation-is-reported-not-just-the-first` matters because this validator runs
against extracted graphs, not hand-written ones. A model that misunderstood the ontology
produced dozens of bad triples in one pass, and fixing them one error message at a time
means one re-extraction per mistake.

Note what is *not* an error: a node with no edges. Isolated nodes are ordinary in a graph
built incrementally, and rejecting them would make partial extraction impossible.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
