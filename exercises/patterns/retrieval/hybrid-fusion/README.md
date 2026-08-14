# Hybrid Fusion

**Tier:** micro. One pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Retrieval Patterns · Hybrid Fusion](https://agentshonestly.com/book/patterns/retrieval/hybrid-fusion)

Merge a vector ranking and a lexical ranking without pretending their scores are comparable.

## The task

Implement `fuse(rankings, k)`, Reciprocal Rank Fusion.

```
score(d) = Σ  1 / (k + rank(d))     over every ranking d appears in, rank 1-based
```

Return document ids ordered by descending score, **ties broken by id ascending** so the
output is total and reproducible.

The thing to notice is what the formula does *not* take: scores. A cosine similarity of
`0.83` and a BM25 score of `11.4` have no common scale, and normalising them is a
decision nobody can defend. RRF only reads positions, which is why it fuses anything.

`consistent-mid-rank-beats-one-first-place` is the case worth reading. `x` is first in
one ranking and last in two others; `m` is never first-and-last but ranks 2, 1, 1, and
wins. `x` still edges out `n` by about eight parts in a million, which is the honest
shape of RRF: a smooth blend, not a veto. All orderings in the fixture were derived by
hand at `k = 60`.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
