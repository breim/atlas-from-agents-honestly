# Idempotency in Practice

**Tier:** build — this is a piece of Atlas. Self-contained, like every exercise here; the
narrative continues in the next build rather than the code.

**Chapter:** [Part XV · Reliability · Idempotency in Practice](https://github.com/breim/agents-honestly/blob/main/content/docs/reliability/idempotency-in-practice.mdx)

At-least-once delivery plus a store you own, and the five ways the illusion leaks.

## The task

Implement `attempt(request, store, config)`, returning
`{ status, errors, alerts, effects, store, outbox }`.

Refuse the whole thing if the store is not durable, if the effect and the record do not commit
together, if the window is shorter than the approval pause, or if the lease is shorter than the
slowest legitimate call.

Otherwise: a `DONE` row deduplicates; an `IN_FLIGHT` row with a live lease makes the caller wait;
a `FAILED` row is retryable only when the failure was **provably** before the effect, and
escalates otherwise. A rejection records `failedBefore: true`; a timeout records `false`. An
external effect commits an intent to the outbox instead of applying inline.

## The property

`a-concurrent-duplicate-waits-on-the-in-flight-row` is why there are three states rather than
two. With only "seen" and "not seen", two workers that arrive together both find nothing and
both execute. The property checks the lease boundary at `until - 1`, `until`, `until + 1`, and
`an-expired-lease-lets-the-next-worker-proceed` is the other half — a dead worker must not
deadlock the key forever.

`a-window-shorter-than-the-approval-pause-is-unsound` is the bug this chapter exists for, and
the test names it explicitly: a 24-hour convention is sized for web requests, and it is
**refused** here, because Atlas pauses for human approval over a weekend. Every component
behaves correctly and a second credit goes out. The window has to exceed the longest interval
over which the same operation could be attempted, which for an agent is the pause and not the
retry policy.

`a-lease-shorter-than-the-slowest-call-is-unsound` is the same shape one level down: expiring the
lease early causes precisely the duplicate the lease exists to prevent.

`a-failed-row-is-retried-only-when-the-failure-was-provably-before-the-effect` is the
distinction that decides whether a retry is safe. A 4xx before anything happened is retryable; a
timeout is not, because the server may have done the work and lost the reply.
`a-timeout-records-that-the-effect-may-have-landed-and-never-claims-it-did-not` checks both the
recorded uncertainty and what happens next: the key escalates rather than quietly retrying.
`a-rejection-before-the-effect-leaves-the-key-free-to-try-again` runs the corrected retry through
to a successful effect.

`a-done-key-never-applies-again-whatever-arrives` throws every outcome kind at a completed key.

`an-external-effect-commits-an-intent-rather-than-the-effect` is the outbox. When the effect
cannot join the transaction, committing the intent alongside the record keeps the atomicity that
`a-marker-and-a-write-in-different-stores-is-unsound` refuses to do without.

`an-unsound-store-never-touches-the-world` is what makes the four preconditions worth checking:
a dedup scheme that cannot hold is not run at reduced confidence, it is not run.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
