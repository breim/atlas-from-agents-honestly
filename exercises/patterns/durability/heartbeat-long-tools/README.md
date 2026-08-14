# Heartbeat for Long Tools

**Tier:** micro. One pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Durability Patterns · Heartbeat for Long Tools](https://agentshonestly.com/book/patterns/durability/heartbeat-long-tools)

Distinguish a tool that is working from a tool that is gone.

## The task

Implement `monitor(startedAt, beats, finishedAt, timeout)`, returning
`{ alive, declaredDeadAt }`.

`startedAt` is the implicit first beat. The activity dies at `previous + timeout` the
first time a gap **exceeds** the timeout, including the final gap between the last beat
and `finishedAt`. Return the moment it was declared dead, or `null` if it survived.

Measuring from the **last beat** rather than from the start is the whole pattern.
`a-long-activity-that-keeps-beating-is-not-declared-dead` runs for 150 units against a
timeout of 30 and is perfectly healthy, because it never went quiet for more than 25.
A timeout measured from the start kills it at 30, which is why heartbeating exists at
all, and why "increase the timeout" is the wrong fix for a long job.

Three edges the cases pin down: a gap of exactly `timeout` survives (the comparison is
strict), the silence after the last beat counts as a gap, and `the-first-fatal-gap-wins`
means the reported time is the first death, not the worst one.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
