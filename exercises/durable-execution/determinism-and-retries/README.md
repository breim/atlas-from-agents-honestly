# Determinism, Retries, and Timers

**Tier:** drill — a self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part X · Durable Execution · Determinism, Retries, and Timers](https://agentshonestly.com/book/durable-execution/determinism-and-retries)

Infrastructure failures retry. Business rejections must not.

## The task

Implement `execute(policy, outcomes)`, returning `{ status, attempts, elapsedMs, lastError }`.

`outcomes` scripts what each attempt does: how long it took, and which error type it raised
(or `null` for success). Walk them in order. The wait before attempt *n* is
`initialIntervalMs × backoffCoefficient^(n-1)`, capped at `maximumIntervalMs`. Stop when the
attempt succeeds, when the error is listed as non-retryable, when the attempt cap is reached,
or when the next wait would not finish inside `scheduleToCloseMs`. `maximumAttempts: 0` means
unlimited.

Nothing in here reads a clock. The schedule is a function of the policy, which is the same
reason workflow code can be replayed at all.

## The property

`a-business-rejection-is-not-retried` and
`an-infrastructure-failure-in-the-same-place-is-retried` are the same call site with two
different errors, and they are the field you will actually configure. `CreditLimitExceeded`
will be exceeded on attempt two, and on attempt five, and at the end of a ten-minute
schedule-to-close. Retrying it burns the budget, delays the real answer, and hides a
decision behind a timeout. `ConnectionReset` is the opposite, and nothing about the two
distinguishes them except a taxonomy someone wrote down.

`an-unlimited-policy-never-fails-and-never-finishes` is the default arriving as a bug.
`maximumAttempts` defaults to 0, which is unlimited, so an activity failing the same way
forever retries forever — and there is no failed workflow to alert on, because the execution
status reads `RUNNING` the entire time. `retrying` is not a terminal state, and that is the
whole point of giving it a name here. It is a defensible default for a platform whose job is
to eventually succeed. It is not one to inherit without deciding.

`a-cap-of-one-means-no-retries-at-all` is the off-by-one everyone writes once.

`the-deadline-refuses-a-retry-it-cannot-fit` is why schedule-to-close exists alongside the
attempt cap. With attempts unlimited, the deadline is the only thing that ends the loop, and
scheduling a wait that runs past it buys nothing but a later failure.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
