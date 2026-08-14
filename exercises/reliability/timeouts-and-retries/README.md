# Timeouts, Retries, and Backoff

**Tier:** drill — a self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part XVI · Reliability · Timeouts, Retries, and Backoff](https://github.com/breim/agents-honestly/blob/main/content/docs/reliability/timeouts-and-retries.mdx)

You did not survive the outage. You amplified it.

## The task

Implement `plan(request, config)`, returning
`{ layers, totalCalls, multiplied, timeoutMs, retryAdmitted, reason }`.

Collapse every layer that does not own this failure class to a single attempt. `totalCalls`
is the product of what survives, times `modelRetries`. The call timeout is the smaller of its
own preference and `reserveBps` of what the run has left. Then decide whether one more retry
is admitted at all: an unowned class, a passed deadline, the run's attempt ceiling, or a
spent retry budget — in that order.

## The property

`three-owners-multiply-to-twenty-seven` is the arithmetic that surprises people, and
`a-second-owner-never-lowers-the-number-of-calls` is it as a rule. Three attempts at the SDK,
three at the node, three at the workflow — each number reasonable, each written by a different
person — is twenty-seven provider calls for one logical step, aimed at a service that is
already struggling. Nested retries multiply. They never add. The fix is not smaller numbers,
it is one owner per class and one attempt everywhere else.

`the-model-is-a-layer-nobody-configured` is the fourth layer, and
`collapsing-every-configured-layer-cannot-bound-the-model` is why it deserves its own field.
Set every configured layer to one attempt and the total still doubles, because the model read
a tool error in its transcript and called the tool again. That layer is not in your retry
metrics, is not bounded by any policy here, and is why traffic during an incident looks
nothing like the arithmetic predicted. Bounding it is a context decision — don't put the error
in the transcript — not a retry-policy one.

`the-call-timeout-is-the-smaller-of-its-own-and-what-remains` is why per-call timeouts do not
compose. Twenty steps at sixty seconds each is a twenty-minute worst case nobody chose, and
the user gave up at ninety seconds. The deadline is set once, at the run, and every call takes
the min — leaving a reserve so the run can still finish and write its result rather than
dying inside the last call it made.

`an-exhausted-retry-budget-fails-through` is the control that feels wrong and is the point. A
per-call cap of three lets total load reach nearly 3×; a budget as a share of traffic brings
it back to roughly 1.1×. And when the budget is spent, the failure passes through
*immediately*, because during a widespread outage retrying mostly converts one failure into
three. Passing through is cheaper, recovers faster, and hands the decision to a fallback or a
breaker — the layer that can actually do something.

`a-permanent-failure-is-retried-nowhere` closes the other half: half of a well-behaved policy
is knowing what to abandon on the first attempt.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
