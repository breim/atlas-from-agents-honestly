# Plan Then Execute

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Control Patterns · Plan Then Execute](https://agentshonestly.com/book/patterns/control/plan-then-execute)

Get the whole plan first, check it, then run it. Not step-by-step improvisation.

## The task

Implement `run(plan, tools)`, returning `{ ok, executed }` or `{ ok, error, executed }`.

Validate the **entire** plan before executing anything:

- every step's tool exists;
- every step id is unique;
- every dependency names a step that appears **earlier** in the plan.

Then execute in declaration order and record the ids in `executed`.

The property is in the failure cases: **an invalid plan leaves `executed` empty.**
`an-unknown-tool-rejects-the-whole-plan` puts a valid `lookup_order` first and
`delete_database` second. Validating as you go runs step one, then discovers step two
is impossible — and now there is a side effect in the world belonging to a plan that
will never finish and has nothing to roll it back. That is strictly worse than doing
nothing, and it is what step-by-step improvisation produces by construction.

Checking dependencies against *earlier* steps rather than the whole plan gets cycle
detection for free — a self-dependency and a forward reference are the same error.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
