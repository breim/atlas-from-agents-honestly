# Lexical Search and Why You Still Need It

**Tier:** drill — a self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part IV · Data & Retrieval Engineering · Lexical Search and Why You Still Need It](https://github.com/breim/agents-honestly/blob/main/content/docs/retrieval/lexical-search.mdx)

The thing embeddings are worst at is the thing users type most confidently.

## The task

Implement `search(query, docs, idf, topK)`, returning `{ id, score }` hits ordered by
descending score, ties by id.

```
score(doc) = Σ  tf(term, doc) × idf(term)     over the query's distinct terms
```

A term with no weight contributes nothing. A document scoring zero is not a hit and is
not returned. A repeated query term counts once.

`an-exact-identifier-dominates-the-ranking` is why this chapter exists. Order `4921` has
an idf of 50 because it appears in exactly one document, and it beats three mentions of
`relay`. That is the query shape dense retrieval handles worst: an identifier has no
semantics to embed, so `4921` and `4922` land almost on top of each other in vector
space, and the model confidently answers about the wrong order.

`a-zero-weight-term-matches-nothing` is the other half. `the` appears everywhere, so it
discriminates nothing and weighs nothing — and `d4`, which is *entirely* `the`, is not a
hit. Returning it with a score of zero would put a meaningless document into a ranked
list that something downstream will truncate by position rather than by score.

One thing this scorer gets wrong on purpose: `a-single-term-ranks-by-frequency` scores
`d1` three times `d2`, because it mentions `relay` three times. Three mentions is not
three times more relevant, and that linearity is precisely what BM25's saturation term
exists to fix. Feel it here first.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
