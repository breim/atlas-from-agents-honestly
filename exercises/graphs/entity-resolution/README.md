# Entity Resolution

**Tier:** drill. A self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part V · Knowledge Graphs · Entity Resolution](https://agentshonestly.com/book/graphs/entity-resolution)

Deciding that two records are the same customer, and living with what that implies.

## The task

Implement `resolve(records, pairs, threshold)`, returning clusters, with ids sorted within
each cluster and clusters sorted by their first id.

A pair at or above the threshold merges. Merging is **transitive**. A pair absent from
the list was never compared, and never merges.

`a-chain-merges-records-that-never-matched-each-other` is the case to sit with. `r1`
matches `r2` at 9000, `r2` matches `r3` at 9000, and `r1` against `r3` scored **200**.
They are plainly not the same entity. All three merge anyway, because a cluster is a
connected component and transitivity is not optional once you have decided merging is an
equivalence.

That is not a bug in this implementation; it is the defining hazard of the technique.
`everything-can-collapse-into-one-cluster` shows where it ends: four records, three
confident pairwise matches, one blob. In a real corpus that blob is every customer named
"John Smith" fused into a single entity holding all their orders, and the graph query
that returns it looks perfectly healthy.

The mitigations live outside this function: a higher threshold, clustering that scores
components rather than edges, or a human queue for anything that merges more than two.
The point of the drill is to see the failure clearly before choosing one.

`an-uncompared-pair-never-merges` is the other half of the design. Blocking is what makes
resolution tractable, because you cannot score every pair in a million-record corpus. Every
pair blocking keeps apart is a merge that will never happen, however identical the two
records are.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
