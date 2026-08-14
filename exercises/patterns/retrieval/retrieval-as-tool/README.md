# Retrieval as a Tool

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Retrieval Patterns · Retrieval as a Tool](https://agentshonestly.com/book/patterns/retrieval/retrieval-as-tool)

When the agent decides whether to search, the search becomes an API — and it needs an API's manners.

## The task

Implement `dispatch(args, corpus, maxTopK)`.

Valid arguments are `query` (non-empty string) and `topK` (integer, `1..maxTopK`).
Anything else is rejected. Every result is a value:

```
{ ok: true,  hits: [...] }
{ ok: false, error: "...", message: "..." }
```

**Nothing throws.** That is the property, and it is not a style preference. A thrown
exception ends the run; a returned error is a tool result the model reads on the next
step and corrects. `topK: 50` against a ceiling of five should produce a run that
succeeds on step three, not a stack trace.

Three details the cases pin down:

- **A non-string query is rejected, not coerced.** `query: 42` is a model that
  misunderstood the schema. Searching for `"42"` hides that.
- **Zero hits is `ok: true`.** "I looked and there is nothing" is an answer. Reporting
  it as an error invites the model to retry a query that will never match.
- **An unknown argument is refused by name.** `tenantId` arriving from the model is
  the model trying to widen its own scope, and the message says which argument was
  refused so the next attempt is a correction rather than a guess.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
