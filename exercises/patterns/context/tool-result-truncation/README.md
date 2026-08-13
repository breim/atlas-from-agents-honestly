# Tool Result Truncation

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Context Patterns · Tool Result Truncation](https://github.com/breim/agents-honestly/blob/main/content/docs/patterns/context/tool-result-truncation.mdx)

Cap what a tool result can spend from the window, without hiding that it was cut.

## The task

Implement `truncate(text, budget, marker)`.

- A result that fits comes back untouched, including when it lands exactly on the budget.
- A result that does not fit comes back at *exactly* the budget, keeping its head and
  its tail with the marker between them. Head and tail split the remaining room; the
  head takes the extra character when the room is odd.
- A budget too small to hold the marker returns the marker cut to the budget. The
  result is useless at that size, which is the point — it is still never over budget.

The property the test proves is the one the pattern claims: **the output never exceeds
the budget, and an elision is always visible.** Character counts are code points, so a
marker of ten characters is ten in both tracks.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
