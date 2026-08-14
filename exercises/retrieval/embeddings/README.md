# Embeddings

**Tier:** drill — a self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part IV · Data & Retrieval Engineering · Embeddings](https://agentshonestly.com/book/retrieval/embeddings)

Cosine similarity, computed by hand, so the thing your vector database does stops being magic.

## The task

Implement `nearest(query, vectors, topK)`, returning `{ id, bps }` hits ordered by
descending similarity, ties broken by id.

`bps` is cosine similarity in basis points: `floor(cos * 10000 + 0.5)`. A **zero vector
has no direction**, so it is excluded from the results rather than scored, and a zero
query matches nothing at all.

`magnitude-does-not-affect-similarity` is the property worth internalising. `[1,0,0]` and
`[7,0,0]` both score a perfect 10000 against `[1,0,0]`. Cosine measures *direction*, and
the length of an embedding carries no meaning you should be reading — which is why a
longer document does not become more similar by being longer, and why using a dot product
instead quietly ranks by verbosity.

`an-opposite-direction-scores-minus-one` is the range people forget. Cosine runs
`[-1, 1]`, not `[0, 1]`. A similarity threshold of `0.0` admits every orthogonal
document — everything unrelated but not actively contradictory — which is most of your
corpus.

The zero vector is a real case, not a pedantic one: it is what an embedding API returns
for empty input, and scoring it as `0` silently ranks a blank chunk above every
contradictory one.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
