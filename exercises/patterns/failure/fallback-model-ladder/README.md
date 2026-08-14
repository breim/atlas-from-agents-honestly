# Fallback Model Ladder

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Failure Patterns · Fallback Model Ladder](https://agentshonestly.com/book/patterns/failure/fallback-model-ladder)

When the model you wanted is unavailable, a lesser answer beats no answer.

## The task

Implement `ask(ladder, outcomes)`, returning `{ answeredBy, tried, spent, status }`.

Walk the ladder from the top. **Fall back only on infrastructure failures** —
`overloaded`, `server_error`. A `refused` outcome stops the ladder with
`status: "refused"`. Running out of models is `status: "exhausted"`. `spent` accumulates
the cost of every model actually called, failed attempts included.

`a-refusal-stops-the-ladder` is the case with an ethical edge, and it is the reason this
is not the same function as [Escalation Ladder](../../control/escalation-ladder). A
refusal is not a failure to answer — it *is* the answer, produced deliberately. Falling
through to a cheaper, less-aligned model until one complies is not resilience; it is
shopping for the response you wanted, with a retry loop as the mechanism. The ladder
exists for capacity problems, and treating every non-success as a capacity problem
quietly converts a safety property into a latency optimisation.

`failed-attempts-still-cost-money` is the accounting most implementations get wrong.
Falling from Opus to Sonnet costs 120, not 20 — the failed call was billed. A cost
report that only counts the model that answered will tell you fallbacks are free.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
