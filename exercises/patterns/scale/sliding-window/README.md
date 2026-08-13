# Sliding Window

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Scale Patterns · Sliding Window](https://github.com/breim/agents-honestly/blob/main/content/docs/patterns/scale/sliding-window.mdx)

Keep what happened recently, by the clock rather than by the count.

## The task

Implement `window(events, now, windowMs)`, returning the kept event ids in original order.

An event is in the window when `at >= now - windowMs`. The boundary is **inclusive** —
`the-edge-of-the-window-is-inclusive` and `one-millisecond-past-the-edge-falls-out` sit
either side of it, and they exist because "last 100ms" is ambiguous prose and a rate
limiter built on the wrong reading is off by one event forever.

The distinction from a count-based window is the point. A window of "the last 20 events"
covers a minute under load and a week when things are quiet, so any threshold you set on
it means two different things depending on traffic. A time window means the same thing
always, and the number of events inside it is what varies — which is usually the quantity
you actually wanted to measure.

`an-event-in-the-future-is-kept` is a deliberate call: a timestamp ahead of `now` is
clock skew between two machines, and it is recent by any reasonable reading. Dropping it
would silently discard events from whichever host drifted forward.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
