# Structured Scratchpad

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Context Patterns · Structured Scratchpad](https://github.com/breim/agents-honestly/blob/main/content/docs/patterns/context/structured-scratchpad.mdx)

Give the agent a small typed surface to write facts to, instead of restating them in prose.

## The task

Implement `render(writes)`, which folds a list of `{ key, value }` writes into the
scratchpad's text form: one `key=value` line per key, joined by newlines.

Two rules, and the second is the one that matters:

- **Last write wins.** Writing `status` twice leaves one line.
- **Keys render in first-write order.** Revising a key edits its line *in place*.

The second rule is why this pattern belongs in a context chapter rather than a data
structure one. A scratchpad that appends revisions to the bottom moves every later
byte, and every cached token after the edit is invalidated. Keeping position stable
means a revision costs one line, not the whole suffix.

The `overwrite-keeps-its-position` case fails any implementation built on a plain
insertion-ordered map that re-inserts on update.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
