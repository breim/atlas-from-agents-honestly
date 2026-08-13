# Retrieval on Demand

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Context Patterns · Retrieval on Demand](https://github.com/breim/agents-honestly/blob/main/content/docs/patterns/context/retrieval-on-demand.mdx)

Retrieve when the agent asks, not on every turn in case it might.

## The task

Implement `run(turns, corpus)`, returning `{ fetches, results }`.

A turn is either `{ say }` — a plain statement — or `{ ask }` — a retrieval request.
`results` has one entry per turn: the statement's own text, or the corpus hit for the
query, or `null`/`None` for a miss. `fetches` lists the queries that actually reached
the index, in order.

Two properties, and they fail differently:

- **A statement never touches the corpus.** Pre-fetching on every turn is the default
  people write first, and it is invisible until the bill arrives.
- **A repeated query is served from the run's cache.** Including a miss — a query that
  found nothing still counts as a fetch, and asking again must not pay for it twice.
  `a-miss-is-still-a-fetch-and-is-still-cached` fails any cache keyed on the *result*
  rather than the *query*, because a missing value looks empty on the second lookup.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
