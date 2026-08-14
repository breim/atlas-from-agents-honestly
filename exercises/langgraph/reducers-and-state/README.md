# Reducers and State Schemas

**Tier:** drill — a self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part VII · Agent & Graph Engineering · Reducers and State Schemas](https://github.com/breim/agents-honestly/blob/main/content/docs/langgraph/reducers-and-state.mdx)

Two nodes wrote to the same channel in the same step. The reducer decides what that means.

## The task

Implement `reduce(state, updates, schema)`, returning `{ state, rejected }`.

Each channel declares how writes combine: `last` (newest wins), `append` (accumulate in
arrival order), `max` (largest wins). A write to an undeclared channel is rejected and
changes nothing. The input state is never mutated.

The batch of updates is the point. `two-parallel-writes-to-an-append-channel-both-survive`
is what two nodes returning in the same superstep actually looks like, and both messages
end up in the transcript. Plain object assignment gives you node B's message and silently
loses node A's — which reads as a flaky agent that "sometimes forgets a step", and is
really a merge strategy nobody chose.

Contrast `two-parallel-writes-to-a-last-channel-keep-the-newest`: the same concurrency,
the opposite correct answer. There is no universally right merge, which is exactly why
the channel declares one instead of the framework guessing.

`a-write-to-an-undeclared-channel-is-rejected` is what makes the schema a schema. A node
returning a key nobody declared is a typo or a node reaching outside its contract, and
either way it should not quietly become part of the state that everything downstream
reads. `a-rejected-write-does-not-stop-the-others` keeps that from being fatal — the bad
key is dropped and named, and the rest of the superstep lands.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
