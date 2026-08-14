# Signals, Updates, and Child Workflows

**Tier:** drill. A self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part X · Durable Execution · Signals, Updates, and Child Workflows](https://agentshonestly.com/book/durable-execution/signals-and-children)

A signal is a message, a query is a getter, an update is a method call.

## The task

Implement `apply(messages, limit)`, returning `{ state, history, responses }`.

Deliver each message to Meridian's refund execution, which starts cold. `signal_with_start`
starts it if it is not running and delivers either way. A `query` reads the phase. An
`update` runs a read-only validator, checking phase first and then amount against `limit`,
and only then touches the workflow. A `signal` is recorded and applied; `timer_expired` escalates a
run still awaiting approval.

One response per message, in order.

## The property

`a-signal-is-accepted-whether-or-not-it-did-anything` is the row of the table that decides
most real choices. Two identical `{ ok: true }` responses: the first escalated the refund,
the second landed on an already-escalated run and did nothing at all. The caller cannot tell
them apart, because the server acknowledges a signal when it is durably recorded, not
when the workflow processes it, and certainly not when it works. Reaching for a signal
anyway is how people end up building a second channel to report the result back.

`an-escalated-run-refuses-the-approval-it-was-waiting-for` is the bill arriving. The signal
that changed everything said nothing; the update that follows is the one that finds out.

`a-rejected-update-is-never-recorded` is what the validator buys. It is read-only and
non-blocking and it fires *before* the request enters history, so "is this workflow even in
a state where that makes sense" stays out of the handler, where it would otherwise be an
awkward branch after the request is already durably written down.

`a-query-adds-nothing-to-the-history` is why the operations console can poll. A query is not
recorded, which is the difference between refreshing a page and appending an event to a
history with a hard ceiling on it. `dropping-every-query-changes-neither-the-history-nor-the-state`
proves it holds for every case: remove all the queries and the execution is byte-identical.

`a-second-signal-with-start-finds-the-existing-run` removes a whole category of code. No
does-a-run-exist check, no race between two processes both deciding to start one, no lookup
table from entity to execution. The entity's id *is* the workflow id.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
