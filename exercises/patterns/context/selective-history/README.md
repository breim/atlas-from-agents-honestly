# Selective History

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Context Patterns · Selective History](https://github.com/breim/agents-honestly/blob/main/content/docs/patterns/context/selective-history.mdx)

Send the turns that matter to this question, not every turn that has ever happened.

## The task

Implement `select(history, threshold, keepLast)`, returning the kept ids in original order.

- An entry is kept when its score is **at or above** the threshold. Inclusive — the
  `the-threshold-is-inclusive` case fails a strict `>`.
- The **last `keepLast` entries are kept unconditionally**, whatever they scored.
- Order is the transcript's, never the score's.

The unconditional tail is the whole point. A relevance score is a guess produced by
something smaller and cheaper than the model you are about to call, and the turn most
likely to be misjudged is the one the user just wrote. `the-tail-is-kept-regardless-of-score`
is the case that proves you did not let the scorer near it.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
