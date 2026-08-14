# Evaluating Graph Quality

**Tier:** drill — a self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part V · Knowledge Graphs · Evaluating Graph Quality](https://agentshonestly.com/book/graphs/evaluating-graph-quality)

An extracted graph is a claim about the world. Score it.

## The task

Implement `evaluate(extracted, gold)`, returning
`{ precisionBps, recallBps, spurious, missed }`.

Triples match **whole**: `from`, `type` and `to` must all agree. Precision is
`correct / extracted`, recall is `correct / gold`, both in basis points with
`floor(x + 0.5)`. An empty side is vacuously perfect on the ratio it is the denominator
of.

`the-right-endpoints-with-the-wrong-relation-is-a-different-fact` is the rule people bend
first. `acme cancelled o-4921` shares both endpoints with `acme placed o-4921` and scores
zero on everything, because it is not a partially correct fact — it is a confident,
well-formed, false one. Partial credit for endpoint overlap makes an extractor that
guesses relations look competent.

`a-reversed-triple-is-also-a-different-fact` is the same rule on direction. `o-4921
placed acme` is grammatically the shape of a triple and semantically nonsense, and it
will happily answer a query about who placed what.

The two rates fail differently, which is why both are reported.
`a-hallucinated-triple-costs-precision-only` recalls everything and invents an order —
the graph is complete and contains a lie. `a-missed-triple-costs-recall-only` is
completely truthful and incomplete. An extractor tuned on one number alone will walk
straight into the other.

`extracting-nothing-has-perfect-precision-and-no-recall` is that trade at its limit, and
the answer is not a bug: an extractor that emits no triples has told no lies, so its
precision is a flawless 10000. Optimising for precision alone rewards exactly that
behaviour, and the graph it builds is empty.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
