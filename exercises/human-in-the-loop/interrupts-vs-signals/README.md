# LangGraph Interrupts vs. Temporal Signals

**Tier:** drill — a self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part XII · Human in the Loop · LangGraph Interrupts vs. Temporal Signals](https://agentshonestly.com/book/human-in-the-loop/interrupts-vs-signals)

Two mechanisms for the same pause. The difference is what re-executes.

## The task

Implement `run(program, mechanism)`, returning `{ effects, executions, duplicated }`.

Walk the node's steps, emitting each effect. Under `temporal` the pause costs nothing: the
workflow resumes at the condition and the node body runs once. Under `langgraph` the
interrupt raises out of the node, and each resume re-enters **from the first line**, so a
node with N interrupts executes N+1 times.

A `subgraph` step is not a boundary — re-entry is from the top of the outermost node.

## The property

`langgraph-re-runs-an-effect-above-the-interrupt` is the whole chapter in one trace.
`issue_credit` appears twice in `effects`, and nothing in the node says it will. The pause is
implemented by replaying the pausing code, so any code above `interrupt()` runs again when
the human answers.

`langgraph-runs-an-effect-below-the-interrupt-once` is the rule that follows: never place
side-effecting code above `interrupt()`. Same node, same interrupt, effect moved down, and
`duplicated` is empty. This is the one-effect-per-node rule arriving from a third direction —
Part VII derived it from checkpoint replay, Part XI from compensation ordering, and here it
falls out of interrupt semantics. Three independent arguments for one constraint is usually a
sign the constraint is real.

`langgraph-re-runs-the-parent-of-a-subgraph-too` is the part that "the node re-runs"
understates, and `wrapping-a-node-in-a-subgraph-changes-nothing` proves it generally.
`record_inbound` runs twice, in a parent node with no `interrupt()` anywhere near it to warn
you. So "put side effects after the interrupt" is not sufficient one level up — and Atlas's
agent loop is a subgraph, which puts this squarely on the path this book recommends.

`langgraph-re-runs-a-two-interrupt-node-twice-over` is why one interrupt per node is not an
aesthetic preference. Three executions, `draft` emitted three times, `issue_credit` twice.
And that is the *well-behaved* version: resume values are matched to interrupts by their
position in the node, so inserting a conditional interrupt above an existing one silently
re-maps every answer below it. An approval was given, an approval was recorded, and they
were not the same approval.

`temporal-never-repeats-an-effect-and-never-re-executes` holds for every program in the
fixture. When you own the code, prefer the mechanism that has no double-execution problem to
design around.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
