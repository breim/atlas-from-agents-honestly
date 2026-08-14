# Partial Result Return

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Failure Patterns · Partial Result Return](https://agentshonestly.com/book/patterns/failure/partial-result-return)

Eight of ten documents is not a failure, and it is not a success either.

## The task

Implement `collect(outcomes)`, returning `{ status, values, failed, coverage }`.

`status` is `complete` when nothing failed, `failed` when nothing succeeded, and
`partial` otherwise. `values` maps the successful items to their results, `failed` lists
the rest in original order, and `coverage` is the success ratio rounded to four decimal
places. No work at all is `complete` with a coverage of 1.

The property is that **partial is a first-class outcome**, and the two boundary cases
police it from both sides. `a-single-failure-is-still-partial-not-failed` is the version
people get right; `a-single-success-is-still-partial-not-failed` is the one they do not,
because two failures out of three feels like a failure and reporting it as one throws
away a document that was successfully processed and paid for.

Both collapses are lies the caller cannot detect. Returning `failed` hides work that was
done; returning `complete` hides work that was not. `coverage` is the number that goes on
a dashboard, and the reason it is rounded rather than raw is that the caller compares it
against a threshold — a ratio that differs in the fifteenth decimal between two languages
makes the same batch pass in one and fail in the other.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
