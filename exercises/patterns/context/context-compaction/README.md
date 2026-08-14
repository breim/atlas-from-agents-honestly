# Context Compaction

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Context Patterns · Context Compaction](https://agentshonestly.com/book/patterns/context/context-compaction)

Decide what leaves the window when it fills, before the provider decides for you.

## The task

Implement `compact(entries, budget)`, returning `{ kept, dropped }` as lists of ids.

Each entry is `{ id, tokens, pinned }`. The rules:

- **Pinned entries are always kept**, even when they alone exceed the budget. A run
  that is under budget and missing its system prompt is not a cheaper run, it is a
  broken one. The budget is a target for the droppable part.
- **Unpinned entries are kept newest-first, while they fit.** That is not the same as
  dropping oldest-first: an oversized recent entry is skipped and an older, smaller one
  can still make the cut. `skips-an-oversized-newer-entry` is the case that separates
  the two readings.
- **`kept` holds original order**, not the order you decided things in. Reordering the
  transcript to save tokens costs you every cached token from the first move onwards.

The `pinned-survives-the-cut` case puts the pinned entry in the middle rather than at
the front, which is what fails an implementation that assumes index 0 is the system
prompt.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
