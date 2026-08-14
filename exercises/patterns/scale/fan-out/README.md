# Fan-Out Over Items

**Tier:** micro. One pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Scale Patterns · Fan-Out Over Items](https://agentshonestly.com/book/patterns/scale/fan-out)

Independent work, run concurrently, under a cap you chose rather than the one your provider enforces.

## The task

Implement `fanOut(items, limit, failures)`, returning `{ results, waves }`.

Process items in waves of at most `limit`. Every item gets a result, `ok: false` if it
is in `failures` and `ok: true` otherwise, **in input order**, whatever order they were
processed in. `waves` records which items shared each slot window.

Two properties:

- **One failure does not cancel the rest.** `a-failure-does-not-stop-later-waves` fails
  the very first item and still expects all four results. A fan-out built on a
  fail-fast primitive loses the work that had already succeeded and never starts the
  work that was queued, so you retry the whole batch to recover one item.
- **Results follow input order, not completion order.** The caller asked about `items`,
  and correlating a result to its input by position is the cheapest correct thing. Any
  other order makes the caller re-derive the mapping, and that is where the off-by-one
  lives.

`a-limit-of-one-is-sequential` is the degenerate case worth keeping: a cap of one is a
legitimate configuration, not a bug, and it is what you set when the downstream service
starts returning 429s.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
