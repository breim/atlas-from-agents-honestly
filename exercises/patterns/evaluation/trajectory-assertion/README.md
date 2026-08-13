# Trajectory Assertion

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Evaluation Patterns · Trajectory Assertion](https://github.com/breim/agents-honestly/blob/main/content/docs/patterns/evaluation/trajectory-assertion.mdx)

The right answer reached the wrong way is a bug that has not surfaced yet.

## The task

Implement `assertPath(steps, spec)`, returning `{ passed, violations }`.

Required steps must appear in the **given relative order** — other steps may sit between
them. Forbidden steps must not appear anywhere. Violations are reported as
`missing:<step>`, `out_of_order:<step>`, `forbidden:<step>`, in that order.

Notice what is absent: the answer. `the-right-steps-in-the-wrong-order-fail` issues the
credit and *then* checks the policy. The credit may well be correct — the customer got
their money, the transcript reads fine, an output-only eval passes. The authorisation
happened after the effect, and the day the policy would have said no is the day you find
out.

`a-forbidden-step-fails-however-good-the-path-looks` is the same argument from the other
side. A trajectory containing `delete_account` fails whatever it returned, because the
question is not whether this run ended well.

`extra-steps-between-required-ones-are-fine` keeps the assertion from ossifying. Pinning
the exact sequence means every prompt improvement breaks the eval, the eval gets relaxed,
and eventually it asserts nothing. Order between the steps that matter; freedom
everywhere else.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
