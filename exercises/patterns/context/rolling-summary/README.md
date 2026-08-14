# Rolling Summary

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Context Patterns · Rolling Summary](https://agentshonestly.com/book/patterns/context/rolling-summary)

Compress old turns into a running summary before the window fills.

## The task

Implement `append(state, turnId, keepRecent)`, which returns the new state.

State is `{ summary: string[], recent: string[] }`. A turn arrives, joins `recent`,
and when `recent` would exceed `keepRecent` the oldest turns fold into `summary`.

A real implementation calls a model to write the summary. Here the summary is the
list of folded turn ids, which is what makes the fold assertable at all — the
property being proved is not the prose quality, it is that **nothing is lost and
nothing is duplicated**. Every turn ever appended appears exactly once, in arrival
order, across `summary` then `recent`.

`keepRecent: 0` folds everything immediately. That is the degenerate case that
catches an off-by-one in the window check.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
