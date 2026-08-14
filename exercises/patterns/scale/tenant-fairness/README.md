# Tenant Fairness

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Scale Patterns · Tenant Fairness](https://agentshonestly.com/book/patterns/scale/tenant-fairness)

One tenant's bulk import should not be every other tenant's outage.

## The task

Implement `schedule(queue)`, returning the task ids in the order they should run.

Round-robin across tenants: one task per tenant per round, tenants taking their turn in
the order they **first appear** in the queue, and a tenant with nothing left simply
skipped. Within a tenant, tasks keep their original order.

`a-noisy-tenant-cannot-starve-a-quiet-one` is the case the pattern exists for. Meridian
enqueues four tasks and Rival enqueues one, last. FIFO runs Rival fifth — so Rival's
single interactive request waits behind somebody else's batch job, and the only thing
Rival did wrong was share a queue. Round-robin runs it second.

Note that fairness is about *turns*, not *totals*: `an-exhausted-tenant-is-skipped` still
gives Rival three consecutive slots at the end, because by then nobody else wants them.
Fair scheduling should not idle a worker to preserve a ratio.

`turn-order-follows-first-appearance` keeps the whole thing deterministic. Ordering
tenants by name would be arbitrary; ordering by arrival means the first tenant to ask is
the first tenant served, which is the property FIFO was trying to give you before it got
confused about what the unit of fairness was.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
