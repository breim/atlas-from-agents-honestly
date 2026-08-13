# Batch Iterator

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Scale Patterns · Batch Iterator](https://github.com/breim/agents-honestly/blob/main/content/docs/patterns/scale/batch-iterator.mdx)

Walk a collection too big to hold, in steps you can stop and resume.

## The task

Implement `nextBatch(items, size, cursor)`, returning `{ batch, cursor, done }`.

Resume immediately after the item the cursor names, take up to `size`, and report the
new cursor. `done` is true once the batch returned reaches the end of the collection.

**The cursor is an id, not an index.** That is the entire design decision.
`an-unknown-cursor-restarts-from-the-beginning` is the honest failure mode of that
choice — an id that no longer exists means starting over, which is recoverable when the
work is idempotent. An index would have carried on from position 3 of a collection that
lost an item, silently skipping one and never telling anybody.

`a-cursor-at-the-end-yields-nothing` and `a-batch-that-exactly-consumes-the-rest-is-done`
are the two ways a caller learns to stop. The empty batch is a valid terminal state, not
an error; a loop that treats "no items" as a failure will retry forever on a collection
it has already finished.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
