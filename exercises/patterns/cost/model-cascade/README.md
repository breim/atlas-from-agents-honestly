# Model Cascade

**Tier:** micro. One pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Cost Patterns · Model Cascade](https://agentshonestly.com/book/patterns/cost/model-cascade)

Ask the cheap model first, and only pay for the expensive one when the cheap one is unsure.

## The task

Implement `cascade(ladder, confidences, threshold)`, returning
`{ answeredBy, tried, spent, escalated }`.

Walk the ladder cheapest-first. A confidence **at or above** the threshold is accepted.
Below it, escalate. The top rung is accepted whatever it scored, because there is nothing
above it, and no answer is not better than the best one available.

`spent` counts every model called, and that is the whole economics of the pattern.
`escalating-all-the-way-costs-more-than-going-straight-to-the-top` is in the fixture as a
deliberate embarrassment: 125 against the 100 that calling Opus directly would have cost.
A cascade is a *bet* that most queries are easy. If the escalation rate is high, the
cascade is strictly worse than not having one. You pay for the cheap attempts and then
pay full price anyway.

That is why `spent` is asserted rather than just `answeredBy`. An implementation that
reports only the model that answered makes the cascade look free, and the escalation rate,
the one number that tells you whether to keep it, never reaches a dashboard.

`the-threshold-is-inclusive` pins the boundary: exactly at the bar is confident enough.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
