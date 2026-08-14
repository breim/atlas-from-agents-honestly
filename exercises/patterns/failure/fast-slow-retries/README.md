# Fast and Slow Retries

**Tier:** micro. One pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Failure Patterns · Fast and Slow Retries](https://agentshonestly.com/book/patterns/failure/fast-slow-retries)

Two different failures wearing the same exception, and they want opposite retry policies.

## The task

Implement `retry(failures, policy)`, returning `{ schedule, attempts, gaveUp }`.

`failures` is how many attempts fail before one succeeds. The policy gives a fast tier
(`fastAttempts` at `fastMs`) and a slow tier (`slowAttempts` at `slowMs`). `schedule` is
the delay **before** each attempt, so it always starts with `0`.

The two tiers exist because two unrelated problems raise the same error. A dropped
connection or a one-off 503 clears in milliseconds, and waiting five seconds to find out
turns a invisible blip into a visible stall. A real outage does not clear in
milliseconds, and retrying it every fifty is a denial-of-service attack you are running
against your own dependency while it tries to recover.

So: absorb the blip fast, then back off hard. `the-fast-tier-is-exhausted-before-the-slow-one-begins`
is the shape: three quick attempts, then the wait jumps by two orders of magnitude.

`failing-forever-still-stops` is the property that matters most in an agent. Every
schedule is finite, `gaveUp` is a real outcome, and something upstream has to handle it.
A retry loop with no ceiling inside an agent loop that also retries is how one flaky
dependency becomes an unbounded bill.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
