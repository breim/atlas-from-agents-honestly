# Two-Stage Rerank

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Retrieval Patterns · Two-Stage Rerank](https://github.com/breim/agents-honestly/blob/main/content/docs/patterns/retrieval/two-stage-rerank.mdx)

Retrieve wide with something cheap, then reorder narrow with something good.

## The task

Implement `rerank(candidates, shortlist, topK)`.

Each candidate carries a `cheap` score (the retriever's) and a `precise` one (the
reranker's). Take the top `shortlist` by `cheap`, reorder *those* by `precise`, return
the top `topK`. Both sorts are descending, ties broken by id ascending.

The case that matters is `a-document-outside-the-shortlist-cannot-be-rescued`. A
document scores `0.1` cheap and `1.0` precise — the best answer in the set — and it
never appears, because the reranker only ever sees what stage one handed it.

That is not a bug to fix here. It is the price of the pattern, and the reason the
shortlist width is a tuning parameter you are expected to measure rather than guess.
An implementation that reranks everything and calls it two-stage has bought accuracy
with the exact cost the pattern exists to avoid.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
