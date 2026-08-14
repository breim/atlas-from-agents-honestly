# Online Guardrail

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Evaluation Patterns · Online Guardrail](https://agentshonestly.com/book/patterns/evaluation/online-guardrail)

An eval that runs on production traffic and can stop it.

## The task

Implement `watch(outcomes, window, floorBps)`, returning `{ tripped, at, worstBps }`.

Slide a window of `window` outcomes over the stream. The success rate of a full window is
`ok / window` in basis points. The guardrail trips the first time a full window falls
**below** the floor, reports that index, and stops evaluating. `worstBps` is the worst
window seen up to and including the trip, or `null` if no window was ever full.

Three properties:

- **A partial window never trips.** `a-partial-window-never-trips` is three failures in a
  row and no alarm. That is uncomfortable and correct: the first requests after a deploy
  are the ones most likely to be odd, and a guardrail that fires on them will be turned
  off within a week — after which it protects nothing.
- **The window rolls.** `an-old-failure-rolls-out-of-the-window` starts badly and
  recovers; the failure ages out and the rate climbs back. A cumulative counter would
  hold that failure against the service forever and eventually trip on a system that is
  healthy now.
- **Tripping is terminal.** `a-recovery-after-tripping-is-still-a-trip` recovers
  completely four requests later, and the guardrail still reports the trip. It already
  fired; something else is handling traffic. A guardrail that un-trips when the numbers
  improve will flap, and flapping alarms get muted.

The floor comparison is strict, and `exactly-at-the-floor-does-not-trip` pins it. Rates
are basis-point integers for the same reason as [Canary Eval](../canary-eval): a boundary
that gates production should not be decided in floating point.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
