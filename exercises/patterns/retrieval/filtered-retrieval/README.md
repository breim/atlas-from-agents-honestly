# Filtered Retrieval

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Retrieval Patterns · Filtered Retrieval](https://github.com/breim/agents-honestly/blob/main/content/docs/patterns/retrieval/filtered-retrieval.mdx)

Similarity is not permission. Filter first, rank second.

## The task

Implement `search(chunks, filter, topK)`.

A chunk survives when its `tenantId` matches **and** it carries **every** tag in
`requireTags`. Survivors rank by descending score, ties by id, capped at `topK`.

`the-highest-scoring-chunk-can-be-filtered-out` is the whole exercise. A chunk from
another tenant scores a perfect `1.0`, the caller's own best scores `0.01`, `topK` is
one — and the answer is the `0.01`. A retriever that ranks first and filters afterwards
returns nothing here, which reads as "no results" and is actually "I found your
competitor's contract and then hid it from you".

That ordering also matters for a reason the fixture cannot show: in production the
index applies `topK` before your code sees a row. Filtering afterwards means the rows
you needed were never returned.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
