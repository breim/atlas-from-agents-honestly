# Batch API Offload

**Tier:** micro. One pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Cost Patterns · Batch API Offload](https://agentshonestly.com/book/patterns/cost/batch-api-offload)

Half price, if nobody is waiting.

## The task

Implement `route(requests, now, batchLatencyMs)`, returning `{ batch, sync }` as lists of
ids in original order.

A request is batchable when `now + batchLatencyMs <= deadline`, so the turnaround fits
inside the time available. A request with **no deadline** is batchable: nobody is waiting
for it. Everything else goes synchronous.

The property is **the deadline decides, never the cost**. Batch is about half the price,
which makes it tempting to default to and let a timeout sort it out. It will not: the
request that misses its window does not fail loudly, it arrives hours later at a user who
left, and the money you saved is on a request that produced nothing.

`an-already-missed-deadline-goes-sync` is the case worth naming. The deadline is already
in the past, so batching cannot possibly help. The only thing left worth doing is
answering as fast as possible. Treating an overdue request as "hopeless, so batch it"
turns a late answer into no answer.

The two boundary cases pin the comparison: exactly at the turnaround is batchable, one
millisecond short is not.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
