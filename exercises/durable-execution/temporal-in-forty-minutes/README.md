# Temporal in Forty Minutes

**Tier:** build — this is a piece of Atlas. Self-contained, like every exercise here; the
narrative continues in the next build rather than the code.

**Chapter:** [Part X · Durable Execution · Temporal in Forty Minutes](https://agentshonestly.com/book/durable-execution/temporal-in-forty-minutes)

The programming model, small enough to hold: workflow code, activity code, an event history,
and replay.

## The task

Implement `run(program, history, world, config)`, returning
`{ status, error, executed, replayed, attempts, history, result }`.

Walk the program. A **workflow** step is orchestration: it runs freely and records nothing — but
if it declares a `uses` the config calls non-deterministic, the execution stops there. An
**activity** step touches the world: if the history already records a completion for its
position, reuse that value and do not run it; otherwise execute it, retrying on failure up to
`maximumAttempts` with a backoff of `initialIntervalMs × coefficient^n`, and append what landed
to the history.

## The property

`a-completed-activity-is-never-executed-again-however-often-it-is-replayed` is the row that
separates this from the previous part. A graph checkpointer resumes the graph and re-executes
the node; here the unit of memoization is the **effect**. The test replays a finished execution
twice: nothing runs, no history is written, and the answer is identical both times.
`a-crash-and-a-replay-never-repeat-a-completed-activity` is the same claim with money in it —
the credit was issued before the crash, and the resumed execution does not issue it again.

`resuming-from-any-prefix-of-the-history-reaches-the-same-result` is the strongest form
available: cut the history at *every* point and every resumption produces the same result and
the same final history, replaying exactly as many activities as the prefix recorded. Durability
is not a property of one convenient restart point.

`a-database-read-in-workflow-code-is-a-determinism-violation` is the mistake to expect, because
reads feel harmless. The row can change between the original run and the replay, so a workflow
that reads diverges from its own history. `the-clock-belongs-in-an-activity-too` and
`the-same-work-in-an-activity-is-fine` are the pair that makes the rule precise: the problem is
never the operation, it is which side of the split it sits on. The property version runs *every*
non-deterministic kind both ways and requires the workflow placement rejected and the activity
placement accepted.

`a-determinism-violation-records-nothing-beyond-what-already-happened` keeps a rejected
execution from leaving half-written history behind it.

`retries-are-bounded-and-the-backoff-is-a-deterministic-exponential` is what "first class" means
here — you do not write the retry loop, and its schedule is computable rather than observed.
`an-activity-that-never-succeeds-fails-the-workflow-at-the-cap` is the other end: it gives up at
the declared bound, reports it, and everything after it never runs.

`the-history-only-ever-grows-and-one-event-per-activity-that-landed` is the invariant the whole
model rests on: an ordered log, one entry per effect, and workflow code never in it.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
