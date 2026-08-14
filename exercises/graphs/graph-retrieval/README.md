# Graph Retrieval

**Tier:** drill. A self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part V · Knowledge Graphs · Graph Retrieval](https://agentshonestly.com/book/graphs/graph-retrieval)

Walk the graph a bounded distance, and let the tenant boundary stop the walk.

## The task

Implement `traverse(start, nodes, edges, maxHops, tenantId)`, returning the visited ids
in breadth-first order. Neighbours are visited in edge declaration order; a node is
visited at most once.

**The tenant predicate applies to traversal, not to output.**
`a-node-behind-another-tenant-is-unreachable` is the case that makes the distinction
concrete: `n1 → f1 → n4`, where `f1` belongs to another tenant and `n4` belongs to yours.
With five hops of budget, `n4` is still never visited. The walk stops at `f1` rather
than stepping over it.

Filtering the *result* instead produces a system that traverses through another tenant's
nodes and then quietly drops them from the output. That leaks structure even when it
leaks no content: which of your entities connect to theirs, how far apart they are, and
whether a given foreign entity exists at all. It also costs you the reads.

`a-cycle-terminates` is the other thing a hop bound alone will not save you from.
`n3 → n1` closes a loop; without a visited set the traversal walks it until the budget
runs out, and with a generous budget that is a lot of pointless reads. Bound *and* visit
set: either alone is insufficient.

`starting-outside-the-tenant-returns-nothing` fails closed at hop zero: the start node
gets the same check as every other node, not a pass for being the start.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
