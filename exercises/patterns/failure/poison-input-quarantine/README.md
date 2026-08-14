# Poison Input Quarantine

**Tier:** micro. One pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Failure Patterns · Poison Input Quarantine](https://agentshonestly.com/book/patterns/failure/poison-input-quarantine)

One message that will never succeed should not stop every message behind it.

## The task

Implement `drain(queue, poison, threshold)`, returning
`{ processed, quarantined, attempts }`.

Each item is attempted until it succeeds or fails `threshold` times, at which point it is
quarantined and the queue moves on. `attempts` counts real processing calls. The test
drives a counting spy, so an implementation that keeps retrying a quarantined item shows
up here.

`a-poison-item-does-not-block-the-queue` is the whole pattern. Without a quarantine, a
malformed message at the head of a queue is retried forever and `good` is never reached.
The queue is not down, the workers are not idle, and nothing alerts. Throughput is
simply zero, and the graph looks like healthy activity.

`each-item-gets-its-own-attempt-budget` pins the counter's scope. A single shared retry
counter means the second bad message inherits the first one's exhausted budget and is
quarantined without ever being tried, and a *good* message after two bad ones is dropped
having never been attempted at all.

Quarantine is not deletion. `quarantined` is a list somebody has to look at. It is where
the schema mismatch, the encoding bug, or the tenant with corrupted data becomes visible.
An empty quarantine and a silently draining queue look identical from the metrics.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
