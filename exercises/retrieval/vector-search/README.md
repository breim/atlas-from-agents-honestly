# Vector Search and the Database Question

**Tier:** build — this is a piece of Atlas. Self-contained, like every exercise here; the
narrative continues in the next build rather than the code.

**Chapter:** [Part IV · Retrieval · Vector Search and the Database Question](https://agentshonestly.com/book/retrieval/vector-search)

The one function that does retrieval, and the three ways to combine a filter with a ranking.

## The task

Implement `search(query, filters, k, index)`, returning
`{ strategy, results, scanned, filtered, shortfall }`.

Embeddings here are one-dimensional integers and distance is the absolute difference, so the
ordering is exact in both languages; ties break on `id`.

Apply the filters — and apply the current-version rule whether or not the caller asked for it.
Then combine similarity with the filter according to `index.strategy`:

- **`post`** — order the whole corpus, take the nearest `probe`, *then* discard what does not
  match, then take `k`. It scans the entire corpus every time.
- **`pre`** — take everything that matches, compute a distance for each, take `k`. Exact, and
  it scans every matching row.
- **`in-algorithm`** — the same exact top-`k` as `pre`, but the walk stays inside the matching
  subgraph and stops at the probe budget.

Report `scanned` (the work done), `filtered` (how many rows matched at all), and `shortfall`
(how much of `k` you could not fill).

## The property

`similarity-orders-and-the-filter-makes-it-correct` is the chapter's central claim, arranged so
that a ranking-only implementation fails loudly: the chunk nearest the query is `POL-114 v6`,
which was superseded in January. It is the best match and the wrong answer.
`the-nearest-chunk-in-the-corpus-is-not-the-nearest-chunk-that-is-correct` asserts exactly that
gap, and `a-superseded-chunk-is-never-returned-by-any-strategy-under-any-filter` closes it
across the whole matrix.

`the-version-filter-is-not-optional` passes **no filters at all** and still excludes both
superseded chunks. That is the difference between a `WHERE` clause and a ranking signal: you
never ask an embedding to prefer the current version, you ask the database, and the caller does
not get to forget. `a-tenant-filter-never-leaks-another-tenants-chunk` is the same rule wearing
its other hat, and `no-tenant-filter-ever-returns-another-tenant-chunk` sweeps every tenant
against every strategy.

`post-filtering-returns-fewer-than-k-when-the-filter-is-selective` is the failure that has no
error message. One row in the corpus satisfies the filter, the probe window is full of nearer
rows that do not, and the query returns **nothing** while asking for three.
`pre-filtering-finds-what-post-filtering-missed` runs the identical filter and finds the row.
Same data, same `k`, different strategy — this is what "search got worse" looks like on a
dashboard that shows no errors and no slow queries.
`post-filtering-can-only-return-rows-the-unfiltered-probe-already-reached` states the mechanism
directly.

`in-algorithm-filtering-gets-faster-as-the-filter-tightens` is the property the other two
lack, and `tightening-a-filter-never-costs-in-algorithm-more-work` proves the direction on both
sides at once: tightening the filter leaves the graph walk scanning less, leaves post-filtering
scanning the entire corpus regardless, and makes post-filtering's shortfall *worse*. That is why
the axis for choosing an engine is filter selectivity rather than corpus size.

`a-loose-filter-is-where-pre-filtering-stops-scaling` is the other end. Ten rows match, the
walk touches five, and pre-filtering computes a distance for all ten — fine here, hopeless over
ten million.

`pre-and-in-algorithm-return-the-same-results-post-may-return-fewer` is the correctness
boundary between the three: pruning is an optimisation, and it is never allowed to change the
answer.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
