# Approximate Search, Honestly

**Tier:** drill — a self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part IV · Data & Retrieval Engineering · Approximate Search, Honestly](https://agentshonestly.com/book/retrieval/ann-indexes)

Measure what the speed cost you.

## The task

Implement `measure(exact, approximate)`, returning `{ recallBps, missed, extra }`.

Recall is `|exact ∩ approximate| / |exact|` in basis points, rounded with
`floor(x + 0.5)`. `missed` is what the exact search found and the index did not; `extra`
is what the index returned instead. Both keep the order of the list they came from.

**Recall is a set measure.** `order-does-not-affect-recall` returns the exact neighbours
backwards and scores a perfect 10000. That is correct and it is also the limitation: an
index that finds all the right documents and ranks them upside down looks flawless here.
Ordering quality is a different measurement, and conflating the two is how a reranker
gets dropped as redundant.

`recall-counts-overlap-not-position` is the number that matters in practice. One
neighbour out of three is 3333 basis points, and the answer the model produces is built
from two documents that the exact search did not consider relevant at all. The index did
not fail — it returned results, quickly, and they were wrong.

`an-empty-exact-set-is-vacuously-perfect` is the boundary that makes recall dangerous as
a solo metric: a query with no correct answers cannot fail. Recall over a golden set with
thin coverage reports numbers that are technically true and mean nothing.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
