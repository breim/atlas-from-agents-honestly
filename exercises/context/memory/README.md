# Memory: Short-Term, Long-Term, and Neither

**Tier:** build — this is a piece of Atlas. Self-contained, like every exercise here; the
narrative continues in the next build rather than the code.

**Chapter:** [Part III · Context Engineering · Memory: Short-Term, Long-Term, and Neither](https://agentshonestly.com/book/context/memory)

The durable-facts store, which is the one of the three that is not a retrieval problem.

## The task

Implement `remember(request, store, policy, now)`, returning `{ recalled, admitted, rejected }`.

Judge the writes first, then answer the reads against the store the admitted writes produced.

A fact is a record, not a string: `value` plus provenance (`source`), authority (`assertedBy`),
recency (`assertedOnDay`) and resolution (`supersedes`). For each read, take the facts for that
tenant, subject and predicate that nothing has superseded, and pick the highest authority,
breaking ties by the most recent. Report the winner with its age, marked stale when the age
exceeds the expiry for its type — `defaultTtlDays` when the type has none.

Refuse a write that carries a secret, one with no provenance, or one asserting the model's own
inference.

The clock is an injected integer day counter, so ages are exact and identical in both
languages.

## The property

`the-highest-authority-wins-before-the-most-recent` is the ordering that makes contradiction
answerable. A human said net-60 on day 1400; the model concluded net-15 on day 1700. The fresher
one loses, because authority outranks recency, and getting that backwards means asking a
probabilistic component to adjudicate a data-integrity question.
`nothing-with-lower-authority-than-the-winner-is-ever-chosen` proves it across every case at
once, including the tie-break.

`a-superseded-fact-never-wins-however-recent` is the append-only trap, arranged so that laziness
cannot pass. The retired address was asserted on day 1600 and the live one on day 1500, so any
implementation that reaches for "just take the newest" returns the address the customer moved
away from. The old version does not go anywhere; it has to be retired explicitly.

`a-fact-from-another-tenant-is-never-recalled` is leakage. Both tenants have a
`payment_terms` fact on the same subject key, so an implementation that forgets the tenant
filter answers northwind's question with acme's terms and vice versa.

`a-stale-fact-is-surfaced-with-its-age-not-dropped` is expiry that does not delete. The
preference is 800 days old against a 400-day expiry, and it comes back marked rather than
missing, because "email, as of two years ago" is useful and a confident bare "email" is not.
`a-fact-goes-stale-without-ever-disappearing` runs the same request far in the future and
checks the value survives the aging. `an-unknown-predicate-falls-back-to-the-default-expiry` is
there because no single expiry policy fits a shipping address and an open-dispute flag.

The three refusals are the writing discipline, which is where memory systems actually fail.
`a-secret-is-never-written-to-memory` is the one that does not degrade slowly: memories are
replayed verbatim into every future context that loads them, indefinitely, where anything that
can read the context can read them. `a-model-inference-is-never-written` keeps conclusions in
the run they belong to, and its write is deliberately well-formed and pointed at a real
`supersedes` target so that only the authority check can stop it.
`a-write-without-provenance-is-rejected` is the fourth field earning its place.

`a-human-correction-supersedes-and-takes-effect-at-once`, and
`a-rejected-write-changes-nothing-that-is-recalled`, are the two halves of admission: what got
in is visible immediately, and what did not get in moved nothing.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
