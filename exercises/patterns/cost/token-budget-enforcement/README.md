# Token Budget Enforcement

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Cost Patterns · Token Budget Enforcement](https://github.com/breim/agents-honestly/blob/main/content/docs/patterns/cost/token-budget-enforcement.mdx)

A ceiling the run cannot talk its way past.

## The task

Implement `enforce(calls, budget)`, returning `{ executed, refused, spent }`.

A call runs when `spent + tokens <= budget`. Otherwise it is **refused whole** and
consumes nothing. The run continues either way.

`a-call-is-refused-whole-never-truncated` is the property, and the temptation it resists
is real: 900 spent, 100 left, a 500-token call arrives, and trimming it to 100 keeps the
run alive and stays under budget. It also sends the model a prompt with four-fifths of
its context missing, and gets back a fluent, confident answer to a question that was
never asked. A refusal is visible. A truncation is not.

`a-refusal-consumes-nothing-and-the-run-continues` is why refusing is not the same as
stopping. The oversized call is skipped, the 100-token call after it fits and runs, and
the run lands exactly on budget. Aborting the whole run on the first refusal throws away
work that was affordable.

`a-call-larger-than-the-whole-budget-can-never-run` is the case that should reach a
person. It is not a budget problem — no budget would have helped — it is a prompt that
needs to be smaller.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
