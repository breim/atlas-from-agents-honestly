# Token and Cost Accounting

**Tier:** drill — a self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part XV · Observability · Token and Cost Accounting](https://agentshonestly.com/book/observability/cost-accounting)

The invoice is one number, thirty days late, with no way to ask which change caused it.

## The task

Implement `account(calls, prices, invoice)`, returning the priced calls, the three spend
buckets, the cache hit rate, the run-cost distribution, the top-runs share, and the
reconciliation.

Price each call from the table version **it recorded**, using integer micros per token.
Split spend into productive, unproductive, and synthetic — those three add up to the total.
The distribution is over run costs, non-synthetic only, with nearest-rank percentiles.
`topRunsShareBps` covers the most expensive `ceil(runs/100)` runs. Reconciliation is the
gap against the invoice, in basis points, against a tolerance.

## The property

`a-repriced-table-does-not-move-an-old-call` is the detail that is cheap now and expensive
later. Two calls, identical tokens, different recorded costs, because they were served under
different price tables. Store raw token counts and multiply by today's price instead and
every historical dashboard silently changes when a vendor adjusts a rate — which makes "we
cut costs 20% in Q3" unfalsifiable. `adding-a-new-price-version-never-moves-a-recorded-cost`
holds that for every case: a wildly inflated 2027 table changes nothing at all.

`cached-input-is-a-different-meter` is the same thousand input tokens as the first case,
mostly served from cache, at 64% of the price. Fold the two counters into one `inputTokens`
field and you destroy the only signal that tells you whether prefix discipline is working —
and cache hit rate is a cost metric, not a performance one.

`the-mean-would-have-said-nothing-was-wrong` is the chapter's figure. Ten runs: p50 and p90
report sixty thousand micros and look healthy, p99 and max report 4.2 million, and one run
took 89% of the fortnight's spend. Run cost is heavy-tailed because input cost is roughly
quadratic in turns, so the few runs that loop dominate the bill — and a rising top-runs share
means a turn cap, not a cheaper model.

`a-retry-costs-full-price` and `eval-traffic-is-its-own-bucket` are the two flags that change
how every other number reads. Retry spend is a reliability incident showing up on the cost
dashboard; eval spend investigated as a leak wastes a week.

`a-gap-means-traffic-that-never-reached-the-gateway` is the row people skip and then regret.
If the recorded total does not reconcile with the invoice, some traffic is not going through
the gateway — a script, a notebook, an integration someone wired directly. That path is a
cost blind spot and a control blind spot at the same time.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
