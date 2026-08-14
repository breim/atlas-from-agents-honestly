# Concurrency, Rate Limits, Backpressure

**Tier:** drill — a self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part XVI · Reliability · Concurrency, Rate Limits, Backpressure](https://github.com/breim/agents-honestly/blob/main/content/docs/reliability/backpressure.mdx)

The quota was never the problem. Nothing decided who gets it.

## The task

Implement `admit(run, used, config)`, returning the verdict plus the numbers behind it.

The client limiter sits at `clientLimitBps` of the provider's `inputTpm`. Each priority gets
`shareBps` of that; each tenant gets `tenantCapBps`. A run is admitted only if the whole
run's estimate fits inside its class budget — counting retries already in flight — and inside
its tenant's cap. Class first, tenant second.

`effectiveConcurrentRuns` is the effective quota divided by what one run consumes per minute.

## The property

`a-batch-job-cannot-cross-the-interactive-floor` and
`a-saturated-batch-share-does-not-touch-interactive` are the 2am incident and its absence.
The eval job is capped at 10% of input TPM, so it is refused when it wants more — and it
still finishes, just later, which is exactly right for a workload with no deadline. Meanwhile
an interactive run arrives with the batch class fully spent and is admitted without noticing.
`saturating-every-other-class-never-changes-an-interactive-verdict` holds that for every case.
Neither row required more capacity. They required someone to decide, in advance, who gets it.

`retries-count-against-the-same-quota` is the interaction that defeats admission control when
it is missed. The limiter meters *new* work; retries are generated inside runs that were
already admitted, so they pass the door without being counted — and under degradation they
rise exactly when there is least room. Here they are in `spent`, and
`forgetting-the-retries-would-have-admitted-work-there-was-no-room-for` shows what the blind
version buys: more headroom on paper and none in the account.

`one-tenant-burst-cannot-starve-the-others` is the class having room and the tenant not. A
shared quota with no per-tenant bound is a cross-tenant failure waiting for traffic.

`a-longer-run-lowers-the-ceiling-further` is the arithmetic that should be on the wall and
usually is not. Two million input tokens per minute sounds enormous; at sixty thousand tokens
of context and twenty turns a minute, it is **one** concurrent run. The worker pool was sized
by CPU, and CPU was never the binding constraint.

Note the unit: the whole run, estimated up front, rather than the next call. A run that
starts and does not finish has spent real money and produced nothing, so rejection at the
door is both the cheapest option and the honest one — a caller told "not now, retry in ninety
seconds" can decide something; a caller stalled at step nine cannot.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
