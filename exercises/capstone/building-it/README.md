# Building It

**Tier:** build — this is a piece of Atlas. Self-contained, like every exercise here; the
narrative continues in the next build rather than the code.

**Chapter:** [Part XX · Capstone · Building It](https://github.com/breim/agents-honestly/blob/main/content/docs/capstone/building-it.mdx)

The design review that runs before the first commit, assembled from every part before it.

## The task

Implement `review(build, questions, policy)`, returning
`{ status, errors, routing, activities, workflowNodes }`.

Block the build for: a catalogue over `maxTools`; any tool taking an argument the system can
derive; a class-4-or-5 tool with no paired read; a node whose placement disagrees with its work;
an unsplit corpus; a workflow id that does not carry the tenant; and a question whose kind has
no retriever. Route every question by kind regardless.

## The property

`no-tool-may-take-an-argument-the-system-can-derive` is the review's sharpest rule, and the
property applies each forbidden argument to **every** tool in turn. `issue_credit` takes an order
id and re-derives the amount; `send_reply` has no recipient parameter at all. Poisoning and
injection arrive at the same fix from different directions, and the fix is removal rather than
validation — a capability the model cannot express needs no policy.

`every-write-above-class-three-needs-a-paired-read-and-reads-do-not` strips the paired read off
each tool and requires exactly the writes to fail. Without it, the "unknown" outcome from the
idempotency chapter is permanently unresolvable: you cannot ask whether the credit landed.

`every-node-sits-on-the-side-of-the-split-its-work-demands` runs the full node-by-placement
matrix. Workflow code decides; activity code discovers; model calls and tool calls are always
activities. `the-graph-is-mostly-activities-and-every-count-adds-up` is the shape that falls out
of it.

`the-four-question-kinds-go-to-four-different-retrievers` is routing before retrieving. Semantic,
aggregation, relationship and live state are four systems with four strategies, and answering an
aggregate from a vector index is the failure Part IV opened with.
`a-question-with-no-retriever-for-its-kind-is-blocked` refuses the fifth kind rather than
guessing one.

`the-catalogue-is-bounded-at-the-boundary` is nine tools and not nineteen, checked at `cap - 1`,
`cap`, `cap + 1`. Every tool is a permission and every description is prompt text billed on every
turn, so the catalogue size is a security decision and a cost decision at once.

`the-tenant-must-appear-in-the-workflow-id` is one decision buying two properties — structural
tenancy and queue routing — and `an-unsplit-corpus-lets-a-poisoned-chunk-reach-a-write` is the
other half of the same defence: the poisoned article can still rank first, and it still cannot
reach a write tool.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
