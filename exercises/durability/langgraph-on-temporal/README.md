# LangGraph on Temporal

**Tier:** build. This is a piece of Atlas. Self-contained, like every exercise here; the
narrative continues in the next build rather than the code.

**Chapter:** [Part XI · Durability in Practice · LangGraph on Temporal](https://agentshonestly.com/book/durability/langgraph-on-temporal)

The integration's placement rules, as a checker you run before the graph does.

## The task

Implement `plan(graph, runtime)`, returning
`{ status, errors, warnings, placement, activityCount, workflowCount, checkpointer }`.

TypeScript is not supported at all, so say so and place nothing. Otherwise check every node:
it must declare `executeIn`; model calls, I/O and interrupts must be activities; and the store
is unreachable from an activity. Conditional edges always run in the workflow, so every one of
them must be async. Below Python 3.11, a graph that needs `interrupt()` or the functional API
gets a **warning**, not an error.

Report where each node landed, and that Temporal's history is the checkpointer.

## The property

`a-node-with-no-execute-in-is-refused` is the design decision worth stealing. `execute_in`
cannot be defaulted project-wide, on purpose, because a wrong default is a determinism bug you
find in production. The property version strips the declaration off **each node in turn** and
requires every one of them refused: the most consequential decision in the system is the one the
tool will not let you skip.

`in-a-real-agent-graph-exactly-one-node-is-not-an-activity` is the shape that surprises people
the first time. Almost everything a useful agent does touches the world, so almost every node
becomes an activity, and `almost-every-node-is-an-activity-and-the-one-that-is-not-is-pure`
checks that the single survivor is the policy invariant, the one piece of Atlas that is pure
computation and nothing can prompt around.

`a-model-call-placed-in-the-workflow-is-refused` inherits the rule from the previous chapter,
and `placing-effectful-work-in-the-workflow-is-refused-every-time` runs each effectful kind both
ways so the boundary is stated rather than illustrated.

`the-store-is-unreachable-from-an-activity-node` is the trap the chapter warns about, because it
fails at the point of **use** rather than at construction, so the graph builds fine and
breaks on the run where that path is finally taken.

`an-interrupt-on-old-python-loads-with-a-warning-and-no-pause` is the most dangerous case here,
and the assertion is deliberately uncomfortable: the status is `ready`. It does not fail. The
plugin loads, the graph runs, and the human approval you designed is silently absent.
`the-same-graph-on-a-supported-python-warns-about-nothing` isolates the version as the only
difference, and `a-graph-with-no-interrupt-and-no-functional-api-does-not-care-about-the-version`
keeps the warning from firing on graphs that never needed either.

`a-synchronous-conditional-edge-needs-porting` is the migration cost nobody budgets: edges run
in the workflow, so every sync edge function has to change.

`typescript-writes-the-workflow-by-hand` and
`temporal-history-replaces-the-checkpointer-rather-than-complementing-it` are the two facts that
decide whether to adopt this at all. You are satisfying two determinism models at once, and a
bad run can be a bug in either.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
