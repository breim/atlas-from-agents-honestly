# Non-Retryable Model Errors

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Failure Patterns · Non-Retryable Model Errors](https://github.com/breim/agents-honestly/blob/main/content/docs/patterns/failure/non-retryable-model-errors.mdx)

Retry what a retry could fix. Nothing else.

## The task

Implement `call(outcomes, maxAttempts)`, returning `{ status, attempts, lastError }`.

`rate_limit`, `server_error` and `overloaded` are retryable. Everything else stops
immediately with `status: "failed"`. Running out of retries on a retryable error is
`status: "exhausted"` — a different outcome, because it means the thing might still work
later.

`attempts` counts real calls. The test drives a counting spy, so an implementation that
declares an error non-retryable and then retries anyway fails here and nowhere else.

The three non-retryable cases are the ones that cost real money. A malformed request, a
rejected key, and a prompt over the context limit are **deterministic**: the second
attempt sends the same bytes to the same endpoint and receives the same rejection, three
times, with backoff sleeps in between. The user waits nine seconds for an error that was
available in one.

`an-unknown-error-is-treated-as-non-retryable` is the deliberate default. An error code
you have never seen might be transient, but assuming so means every new failure mode
your provider ships arrives as a 3× traffic multiplier against a service that is already
having a bad day.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
