# An Error Taxonomy for Agents

**Tier:** drill — a self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part XVI · Reliability · An Error Taxonomy for Agents](https://agentshonestly.com/book/reliability/error-taxonomy)

The only useful question about an error is what should happen next.

## The task

Implement `route(failures, catalogue)`, returning the routed failures plus the four lists
that dispatch on them.

The catalogue owns the class and the blame — the adapter assigned them, not a substring
match on vendor prose. From those two facts derive: retryable (transient only), escalates
(policy only), what the model is shown, and whether a `Retry-After` survives. Then
`countedInErrorRate` leaves out the two classes that are not failures your code received.

## The property

`the-model-mistake-goes-back-into-the-transcript` and `your-bug-stays-in-your-logs` are both
permanent, both un-retryable, and have opposite audiences. `account 9917 does not exist` is
the model's mistake and the model's to recover, so it goes into the transcript written as an
instruction. `cannot read property of undefined` is yours, the model can do nothing with it,
and showing it just fills the context with noise. "Permanent" is two different things and the
blame column is what separates them.

`a-recovered-transient-failure-is-never-shown-to-the-model` is the row that reads backwards
until you see the failure. A model that finds `socket hang up` in its history starts reasoning
about network conditions — or calls the tool again itself, which is the fourth retry layer
nobody configured.

`a-context-length-error-is-permanent-not-transient` is the misfiling with a price tag. It
arrives as a `400` in the middle of a long run, looks like an API error, and gets retried:
the same oversized prompt, rejected three more times, billed each time. The recovery is
compaction and re-entry, which is a different code path entirely.

`a-refusal-is-policy-and-is-not-rephrased` is the misfiling with a worse price. The reflex is
to reword and try again, which is building a workaround for a control. If the refusal is
wrong that is a product problem to fix deliberately; if it is right, retrying until it passes
is the worst available response.

`budget-exhaustion-is-not-an-error` and `the-error-rate-is-a-floor` are why the last two
classes are absent from `countedInErrorRate`. One is the system stopping cleanly at a limit
you set; logging it at ERROR trains everyone to ignore the channel. The other never raised at
all — a `200 OK`, a clean trace, valid arguments, and a refund policy that expired in March.
Nothing in this part catches it, and giving it a name anyway is what stops a team believing
its error rate is its failure rate.

`one-root-cause-lands-in-four-classes` is how an incident actually reads: a provider
degradation becomes a budget exhaustion becomes a smaller model's bad arguments becomes a
wrong answer. Four dashboards, one cause.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
