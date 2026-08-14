# Priority Task Queues

**Tier:** micro. One pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Scale Patterns · Priority Task Queues](https://agentshonestly.com/book/patterns/scale/priority-queues)

An interactive request and an overnight backfill should not wait in the same line.

## The task

Implement `order(tasks)`, returning the task ids in execution order.

Higher priority first; within a priority, **submission order is preserved**. That second
half is the part that gets lost: a naive sort by priority alone is free to reorder equal
elements, and `submission-order-breaks-ties` fails on any runtime whose sort is not
stable. Sorting on the pair `(-priority, index)` is the fix, and it makes the tie-break
explicit rather than inherited from whichever engine you happen to run on.

`a-flood-of-high-priority-work-starves-the-rest` is in the fixture on purpose, and it is
not a bug to fix here. A plain priority queue starves low-priority work whenever
high-priority work keeps arriving. Three urgent tasks push `lo1` to last, and had there
been thirty, it would still be last. Seeing that in a passing test is the point: the
mitigation is aging, or a separate worker pool, and both are decisions you make after
you have accepted this behaviour rather than assumed it away.

Contrast with [Tenant Fairness](../tenant-fairness), where the whole design goal is that
nobody gets starved. Priority is the opposite trade, made deliberately.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
