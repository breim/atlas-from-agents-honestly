# Query Rewriting

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Retrieval Patterns · Query Rewriting](https://agentshonestly.com/book/patterns/retrieval/query-rewriting)

The user's words and the corpus's words are not the same words.

## The task

Implement `rewrite(query, synonyms)`, returning the expanded query as a string.

Split the query on whitespace. The output is a deduplicated ordered list: every original
term first, in first-occurrence order, then each term's synonyms in the order their
trigger terms appeared — skipping anything already in the list.

Three rules the cases pin down:

- **Original terms come first, in their original order.** A lexical scorer weighs
  position; a rewrite that shuffles the user's query is scoring something the user
  did not ask.
- **No duplicates.** `never-duplicates-a-term-already-present` asks for `relay switch`,
  where `switch` is both an original term and a synonym of `relay`. It appears once.
- **A repeated trigger expands once.** `relay relay` does not append the same two
  synonyms twice.

This is deliberately a lexical rewrite, not a model call. The property being proved is
that expansion is *additive and order-preserving*, which stays true whatever generates
the synonyms.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
