# Saga for Tool Side Effects

**Tier:** micro. One pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Durability Patterns · Saga for Tool Side Effects](https://agentshonestly.com/book/patterns/durability/saga-for-tools)

You cannot roll back a refund. You can only issue the opposite of one.

## The task

Implement `runSaga(steps, failAt)`, returning `{ ok, completed, compensated }`.

Run steps in order until one fails. On failure, compensate the completed steps **in
reverse order**. Steps after the failure never run.

Two rules the cases pin down, and both are the kind of thing that looks like a detail
until it is an incident:

- **The failing step is not compensated.** `the-failing-step-is-not-compensated` fails
  on `charge`, and only `reserve` is compensated. A `charge` that failed took no effect,
  and refunding a payment that never happened is not a cleanup. It is a second bug,
  paid for in real money.
- **Reverse order, not any order.** `ship` compensates before `charge`, which compensates
  before `reserve`. Undoing forwards means releasing an inventory reservation while the
  shipment that depends on it is still being cancelled.

`failing-on-the-first-step-compensates-nothing` is the boundary: nothing completed, so
there is nothing to undo, and the saga is still a failure. An empty `compensated` list
is not evidence that cleanup was skipped.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
