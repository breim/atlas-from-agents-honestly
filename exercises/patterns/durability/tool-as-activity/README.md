# Tool as Activity

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Durability Patterns · Tool as Activity](https://github.com/breim/agents-honestly/blob/main/content/docs/patterns/durability/tool-as-activity.mdx)

A workflow replays. A tool call must not.

## The task

Implement `replay(history, calls, run)`, returning `{ results, history, invocations }`
or the same plus an `error`.

Walk the calls in order against the recorded history:

- a call with a matching history entry returns the **recorded** result and does not execute;
- a call past the end of the history executes via `run(activity)` and appends to the history;
- a call whose name disagrees with the history entry at that position is non-determinism —
  stop, execute nothing, and return the error.

`invocations` counts real calls to `run`. The test passes a counting spy, so an
implementation that executes the tool and then returns the recorded value instead
passes every other assertion and fails this one. That is the bug worth catching: the
output looks perfect and the side effect happened twice.

`history-is-consumed-in-order-not-by-name` is the case that kills the obvious shortcut.
Two `issue_credit` calls have two different recorded results, and a cache keyed on the
activity name returns `credit A` for both — one credit issued, two reported.

The non-determinism case is why workflow code has rules about randomness and clocks: a
replay that takes a different branch than the original run cannot be reconciled, and the
only safe move is to stop rather than guess which history is right.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
