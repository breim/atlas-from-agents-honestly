# Hybrid Search and Reranking

**Tier:** drill — a self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part IV · Data & Retrieval Engineering · Hybrid Search and Reranking](https://github.com/breim/agents-honestly/blob/main/content/docs/retrieval/hybrid-and-reranking.mdx)

Find out whether hybrid actually beat the better half of itself.

## The task

Implement `compare(runs, relevant, k)`, returning
`{ semanticBps, lexicalBps, hybridBps, verdict }`.

Each run is scored on recall@k in basis points. The verdict compares hybrid against
**the better of the two single retrievers**: `gain`, `no_gain`, or `regression`.

`hybrid-loses-to-the-better-retriever` is the case this drill exists for. Semantic
already had both relevant documents in its top three. Fusion mixed in a lexical run that
found nothing, the junk it ranked highly displaced `r2`, and the hybrid pipeline is
*worse* than the retriever it was built on top of. That happens, it happens quietly, and
it is invisible unless you measure all three.

Which is the point about the comparison itself. The tempting benchmark is hybrid against
semantic — the one you had before. `hybrid-matches-the-better-retriever-and-buys-nothing`
would pass that benchmark and it bought nothing at all: same recall, two retrievers,
twice the latency and twice the infrastructure. Comparing against `max(single)` is what
turns "hybrid is better" into a claim with a number behind it.

`each-retriever-finds-a-different-half` is the case hybrid is *for*: each retriever
recalls half the relevant set, they disagree about which half, and fusion beats both.
When your retrievers fail on disjoint queries, hybrid earns its cost. When they fail on
the same ones, it does not.

`a-query-with-no-relevant-documents-proves-nothing` scores 10000 across the board and
reports `no_gain` — a reminder that a run everything passes is not evidence for anything.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
