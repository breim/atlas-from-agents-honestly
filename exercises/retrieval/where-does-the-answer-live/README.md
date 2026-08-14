# Where Does the Answer Live?

**Tier:** drill — a self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part IV · Data & Retrieval Engineering · Where Does the Answer Live?](https://agentshonestly.com/book/retrieval/where-does-the-answer-live)

The routing decision that precedes every retrieval choice.

## The task

Implement `route(signals, table, fallback)`, returning the store to query.

The table is ordered. The **first rule in table order** whose signal is present wins.
A query with no recognised signal falls back to semantic search.

`table-order-decides-not-signal-order` is the property. A query carrying both
`exact-identifier` and `aggregation` routes to SQL, because SQL sits higher in the table
— not because of the order the signals were detected in. Routing that depends on
detection order makes the same question route differently depending on which analyser
ran first, and that is untraceable in production.

The precedence itself is the argument the chapter makes.
`freshness-outranks-aggregation` puts `needs-current-state` at the top: a question about
what is true *right now* cannot be answered from an index built last night, however well
the aggregation would have worked. Anything derived from a snapshot is wrong for a
freshness question, and it is wrong in the most convincing way — a precise number that
was true yesterday.

The fallback deserves its own sentence. Semantic search is the default not because it is
right most often, but because it is **wrong least badly**: it returns something loosely
related instead of a confident exact answer to a question you did not ask.
`an-unrecognised-signal-also-falls-back` keeps that true for signals you have not taught
the router about yet.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
