# Worker-Specific Queues

**Tier:** micro. One pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Scale Patterns · Worker-Specific Queues](https://agentshonestly.com/book/patterns/scale/worker-specific-queues)

Not every worker can run every task, and pretending otherwise fails at the far end.

## The task

Implement `route(tasks, queues)`, returning `{ routed, unroutable }`.

A task goes to the **first declared queue whose capabilities cover every one of its
needs**. A task no single queue can fully serve is unroutable. Tasks keep their order
within whichever queue they land on.

The property is **all-or-nothing coverage**. `needs-spread-across-two-queues-are-unroutable`
asks for `rerank` and `http`: the `gpu` queue has one, `egress` has the other, and no
queue has both. Routing it to whichever queue matched *some* needs is the tempting bug:
the task sits in a real queue, a real worker picks it up, and it fails on the capability
that was never there. The failure lands minutes later, in a worker log, detached from the
routing decision that caused it.

Rejecting at routing time keeps the diagnosis where the mistake is. `unroutable` is a
list somebody must look at. It means the fleet cannot do what was asked, which is
capacity planning, not a runtime error.

`a-task-with-no-needs-goes-to-the-first-queue` pins the vacuous case: an empty needs list
is covered by every queue, so the first one wins. It should not be unroutable.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
