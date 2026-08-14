# Conditional Edges and Subgraphs

**Tier:** build. This is a piece of Atlas. Self-contained, like every exercise here; the
narrative continues in the next build rather than the code.

**Chapter:** [Part VII · LangGraph · Conditional Edges and Subgraphs](https://agentshonestly.com/book/langgraph/routing-and-subgraphs)

Branching, the two bounds a loop needs, and the difference between a subgraph you can reuse and
one you merely split out.

## The task

Implement `run(graph, input, updates, subUpdates, config)`, returning
`{ status, errors, path, superSteps, state, views }`.

**Validate first**, and refuse to run at all if anything fails:

- a router that names a destination outside its declared list;
- a router whose predicate reads a field listed in `transcriptFields`;
- a semantic bound whose super-step cost (`bound × superStepsPerPass`) is not *below* the
  backstop.

**Then run.** Every visit increments `step`. A router takes its first matching branch, else
`otherwise`; a router with `fanOut` runs every branch in turn and continues from `join`. Updates
merge through `reducers`: `sum` adds, `concat` appends, everything else is last-write-wins.

Reaching the `halt` node is a **result**. Reaching the backstop is an **error**.

A `transformed` subgraph is handed a fresh state built from `passes` and gives back only
`returns`. A `shared` one is handed the parent's state and everything it wrote comes back.
Record what each subgraph `saw` and `returned` in `views`.

## The property

`the-semantic-bound-produces-a-result-not-an-exception` and
`a-loop-you-did-not-bound-hits-the-backstop-and-that-is-an-exception` are the same loop twice,
and the difference is the whole section. One ends `halted` with no errors, routes to a human,
and is a reportable outcome. The other ends `crashed` with a message about super-steps, which
is a stack trace in your logs where a result should have been.
`removing-the-semantic-bound-turns-a-result-into-an-exception` performs the conversion directly:
strip the `halt` branch out of the router and the identical graph stops producing outcomes.

`a-backstop-below-the-semantic-bound-inverts-the-arrangement` is the arithmetic that catches
people. A bound of twelve passes at three super-steps each is thirty-six, and a default backstop
of twenty-five sits *under* it, so the thing you meant as a last resort becomes the thing that
stops your runs. `a-graph-whose-backstop-undercuts-its-own-bound-is-always-rejected` sweeps the
boundary, checking `owed - 1`, `owed`, and `owed + 1` so the comparison cannot be off by one.

`a-router-may-only-return-a-destination-it-declared` is why the destination list is not
decoration. A router that can return anything produces a graph nobody can draw, and no
`compile()` can tell you a node is unreachable.
`a-router-that-reads-the-transcript-is-rejected` is the other half: the moment a branch reads
`messages`, you have a router you cannot unit-test without constructing a conversation, and one
whose behaviour changes when a prompt changes. Both are checked over every graph in the fixture,
not just the case that demonstrates them.

`a-transformed-subgraph-sees-only-what-was-passed` is sub-agent isolation with a type signature.
The parent's state carries eleven turns of transcript; the subgraph is handed two fields and
cannot see it, because it is not in its state, enforced by the schema rather than by
discipline. `a-transformed-subgraph-returns-only-the-fields-it-declared` closes the other
direction: the subgraph writes a private `scratch` note and it never reaches the parent.
`shared-mode-leaks-exactly-what-transformed-mode-withholds` runs the same graph both ways and
shows the trade with nothing else moving: same path, wider view, wider blast radius.

`a-commutative-reducer-survives-reordering-and-concatenation-does-not` is the honest version of
the fan-out rule. Reverse the branch order: `score` is unchanged because summing is commutative,
and `findings` comes back in a different order because concatenation is not. Both reducers are
legitimate; only one of them lets something downstream depend on branch order safely. The test
asserts the sum is stable, the set of findings is stable, and the *sequence* is not, which is
exactly why the chapter says nothing downstream may depend on it.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
