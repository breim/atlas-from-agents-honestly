# Evaluating Retrieval

**Tier:** drill. A self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part IV · Data & Retrieval Engineering · Evaluating Retrieval](https://agentshonestly.com/book/retrieval/retrieval-evals)

Three numbers, because no one of them tells you whether retrieval is working.

## The task

Implement `score(retrieved, relevant, k)`, returning
`{ recallBps, precisionBps, rrBps }`, all basis points, `floor(x + 0.5)`.

Only the first `k` results count.

- **recall@k.** Relevant documents found, over all relevant documents. Vacuously full
  when nothing was relevant.
- **precision@k.** Relevant documents found, over how many you actually returned
  (`min(k, retrieved)`), so a short list is not punished for being short.
- **rr@k.** Reciprocal rank of the *first* relevant hit; zero if none is in the top k.

Read `one-relevant-hit-at-the-top` and `the-same-hit-lower-down-costs-reciprocal-rank-only`
together. Identical recall, identical precision, and the only thing that changed is that
the answer moved from first to third, which is the difference between the model reading
it and the model reading two irrelevant documents first. Recall and precision cannot see
position at all. That is what reciprocal rank is for, and why a retrieval eval reporting
only recall will tell you a reranker changed nothing.

`a-relevant-document-outside-the-cut-is-not-recalled` is the other half: the document is
right there at position four and scores zero on everything, because `k` is what the model
will actually see. An eval measured over the full result list flatters a retriever whose
output gets truncated before it reaches the prompt.

`a-query-with-no-relevant-documents-recalls-vacuously` returns 10000 recall and 0
precision, the pair that shows why these are reported together rather than averaged into
one score.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
