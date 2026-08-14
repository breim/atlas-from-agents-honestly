# Tool Result Design

**Tier:** drill — a self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part VIII · Tool Engineering · Tool Result Design](https://github.com/breim/agents-honestly/blob/main/content/docs/tools/result-design.mdx)

What the tool returns is context you are choosing to spend.

## The task

Implement `shape(present, spec, budget)`, returning `{ kept, dropped, tokens, fits }`.

The spec lists fields in priority order and marks which are essential. Essential fields
present in the result are **always kept**. Optional ones are added in spec order while
they fit. A field the spec does not name is dropped. `fits` is false when the essentials
alone exceed the budget.

`essentials-over-budget-do-not-fit-and-are-not-truncated` is the case with the opinion.
The essentials come to 20 tokens against a budget of 15, and the function keeps them
anyway and reports `fits: false`. Dropping `orderId` to get under budget produces a
result that is the right size and useless — the model cannot make the follow-up call it
was going to make, so it improvises an id or gives up, and either way the budget saved
nothing. An over-budget result is a signal to fix the tool, not a string to trim.

`a-lower-priority-field-is-dropped-before-a-higher-one` is why the spec is ordered rather
than a set. `rawPayload` is 500 tokens of upstream JSON that nobody reads and everybody
pays for on every call it appears in. Ordering says out loud which fields earn their
space.

`a-field-not-in-the-spec-is-dropped` closes the boundary: `internalShardKey` came back
from the upstream API and is not something the model should see, so it does not become
part of the context by accident.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
