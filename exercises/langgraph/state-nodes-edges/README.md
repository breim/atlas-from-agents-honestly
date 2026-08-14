# State, Nodes, Edges

**Tier:** build. This is a piece of Atlas. Self-contained, like every exercise here; the
narrative continues in the next build rather than the code.

**Chapter:** [Part VII · LangGraph · State, Nodes, Edges](https://agentshonestly.com/book/langgraph/state-nodes-edges)

The graph engine, small enough to fit in one file, and Atlas rebuilt on top of it.

## The task

Implement `execute(spec, input, updates, limits)`, returning
`{ status, errors, path, position, state }`.

**Validate first.** Before a single node runs, catch an edge naming a node that does not exist,
a node unreachable from the entry, and a node with no path to `END`. Report the dangling edges
alone if there are any; otherwise report the reachability and termination problems together.
An invalid graph runs nothing.

**Then run.** Start at the entry. Each visit takes the node's next scripted update and *merges*
it into state. Where a conditional edge is declared, walk its branches in order and take the
first whose predicate holds over state, falling back to `otherwise`; where an unconditional
edge is declared, take it; otherwise stop. Halt at `maxSteps`.

Predicates are `{field, equals}` or `{field, atLeast}`, declared in the fixture as data,
because that is the whole point.

## The property

`routing-reads-state-so-changing-state-changes-the-route` is the correction the chapter says
people get backwards. A graph does not hand control flow to the model: change what `triage`
wrote into state and the *edge* sends the run to `escalate` instead of `gather`, without any
model being consulted. The predicates live in the fixture as data, so there is nowhere in this
implementation for a model to hide inside a routing decision.
`the-same-graph-and-the-same-updates-always-produce-the-same-path` states the consequence.

`a-node-with-no-path-to-end-is-caught-before-anything-runs`,
`an-unreachable-node-is-caught-before-anything-runs`, and
`an-edge-to-a-node-that-does-not-exist-is-caught` are the class of bug the hand-written loop
had no way to detect. `an-invalid-graph-runs-nothing-at-all` is the half that matters
operationally. Not merely that the errors are reported, but that no node executed, no state
changed, and the position never moved. `validation-is-structural` proves it does not depend on
the run by throwing arbitrary input and updates at the same broken graphs and getting identical
errors.

`a-node-returns-an-update-not-a-new-state` is the mechanical detail with consequences. The
ticket arrives carrying `locale`, no node ever mentions it, and it is still there at the end.
`nothing-a-node-did-not-touch-is-ever-lost` asserts that for every case at once, which is what
keeps nodes independent: adding a field does not mean touching every node.

`the-whole-agent-loop-is-one-self-edge` is every prebuilt ReAct agent, drawn: two nodes, one
conditional edge, and a cycle that exists because `agent → tools → agent` is an edge rather
than a `while`. `the-cycle-is-bounded-by-a-function-of-state` is the v0 step cap relocated
into something testable, and `a-cycle-that-never-satisfies-its-condition-halts` keeps the hard
bound underneath it: a predicate that is always true still terminates.

`every-path-through-the-Atlas-graph-ends-at-finalize` is the outcome union enforced
structurally rather than by discipline. Escalation is not an exit; it is an edge to `finalize`,
so there is no way to leave the graph without logging what happened. Four of the six nodes
contain no model call at all, and the policy check is one of them: the graph did not make Atlas
more autonomous, it made the non-autonomous parts visible.

`the-path-starts-at-the-entry-and-every-step-follows-a-declared-edge` is the property that
makes the rest meaningful. The path is not a log the engine narrates; it is the position,
recorded, and every transition in it has to correspond to an edge somebody declared.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
