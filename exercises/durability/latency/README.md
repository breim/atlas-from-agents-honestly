# Paying for Durability in Milliseconds

**Tier:** drill. A self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part XI · Durability · Paying for Durability in Milliseconds](https://agentshonestly.com/book/durability/latency)

There is one stretch where durability overhead is not hidden behind anything.

## The task

Implement `plan(steps, config)`, returning `{ placements, entryLatencyMs }`.

A step runs as a **local activity**, skipping the task-queue round trip, only when nothing
disqualifies it and it sits on the entry path. Four disqualifications, checked in order: it
is a model call, it needs to heartbeat, it must stay reachable by a signal while it runs, or
it runs longer than `localBudgetMs`. A step off the entry path is a regular activity too,
with its own reason.

`entryLatencyMs` is the entry path only: each step's duration, plus `roundTripMs` for each
one still dispatched through the queue.

## The property

`a-model-call-is-never-local` is the rule with no exceptions, and the case is built to look
like an exception. Fifty milliseconds, on the entry path, no heartbeat flag, no signal flag,
and still an activity. A model call is long, it needs heartbeating to prove liveness, it
needs cancellation propagation so an abandoned run stops paying for tokens, and while it runs
**no signal can reach the workflow**. Local activities lose all four. The saving would be a
few milliseconds against a call that takes seconds, and it would break steering to get them.

`a-step-that-must-hear-a-signal-is-never-local` is that fourth property on its own, because
it is the one that generalises. Everything Part XI builds depends on a running execution
being reachable: approvals, cancellations, customer replies. A local activity blocks exactly
that for its duration, so anything on the steerable path is a regular activity regardless of
how cheap it is.

`everything-after-the-acknowledgement-is-left-alone` is the decision the chapter actually
argues for. A three-millisecond formatter off the entry path is *not* made local, because
there is a four-second model call ahead of it and the round trip disappears into it. Median
runs are minutes; journalling a step is single-digit milliseconds. Optimising there is
optimising the wrong thing.

`the-atlas-entry-path-pays-no-round-trips` is the payoff: fifteen milliseconds for the whole
acknowledgement path, against 375 if each of those three steps went through the queue. One
path optimised, the other eight minutes deliberately not.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
