# Untrusted Content Marking

**Tier:** micro. One pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Security Patterns · Untrusted Content Marking](https://agentshonestly.com/book/patterns/security/untrusted-content-marking)

Where text came from is a fact you can record. Whether it is hostile is not.

## The task

Implement `ceiling(sources, order)`, returning the trust ceiling of a context.

`order` runs from least to most trusted: `external`, `reviewed`, `system`. The ceiling is
the **minimum** trust across every source in the context. An empty context is fully
trusted. A marking you do not recognise is treated as the lowest level in the order.

The property is that **one untrusted source caps everything**. `quantity-does-not-matter`
puts three system sources against one external chunk and the answer is still `external`;
`position-does-not-matter` moves it to the front and nothing changes. There is no
averaging, no majority, no "mostly trusted". A context containing one attacker-controlled
passage is an attacker-controlled context, and the write path downstream needs that
single fact.

Marking at ingestion, by provenance, is what makes this computable at all. The
alternative, deciding at read time whether a passage *looks* adversarial, is a
classifier, it is wrong sometimes, and the failure is silent. Provenance is a lookup, and
the exercise is deliberately three lines because that is the point: the hard part of this
pattern is remembering to attach the label upstream, not computing it here.

`an-unknown-marking-is-treated-as-external` is fail-closed. A source whose provenance you
cannot name is a source you cannot vouch for.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
