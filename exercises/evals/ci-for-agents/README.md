# CI for Agents

**Tier:** build. This is a piece of Atlas. Self-contained, like every exercise here; the
narrative continues in the next build rather than the code.

**Chapter:** [Part XIII · Evaluation · CI for Agents](https://agentshonestly.com/book/evals/ci-for-agents)

Deciding which gates you are actually entitled to.

## The task

Implement `audit(suite, policy, question)`, returning
`{ status, errors, detectablePoints, gated, reported, expectedFalseAlarmsBps }`.

Derive the smallest regression the set can detect from `casesPerArm` against the policy's
table. Then judge each criterion: a deterministic one gates at any size; a judged one may only
gate on an effect at least that large, and gating on anything smaller is an error. Ungated
criteria are reported. Charge each **judged** gate against the flake budget. Require the
tightest configuration for "did it change", production settings and several seeds for "how good
is it", and a re-run policy declared in advance.

## The property

`the-detectable-effect-follows-the-set-size-at-every-step-of-the-table` walks the whole power
table, checking each threshold and the case just below it, and finishes by asserting that twenty
cases detect **nothing**. That is the number worth sitting with: a well-built golden set finds
about a five-point regression, and nothing realistic finds two.
`a-two-point-regression-is-not-detectable-by-anything-realistic` makes the refusal explicit,
and it is not a failure of the suite, it is information. The gate is not available, so something
else has to catch it.

`a-judged-criterion-may-only-gate-on-an-effect-the-set-can-see` checks the boundary at
`detectable - 1`, `detectable`, `detectable + 1`. A gate below the floor is a coin flip with a
changelog, and the real damage is that it destroys trust in the gates that were sound.
`an-ungated-criterion-is-reported-rather-than-refused` is the escape hatch that makes the rule
usable: gate what you can detect, report the rest.

`a-deterministic-criterion-gates-at-any-set-size-and-a-judged-one-does-not` is the CI argument
for moving criteria down the scoring ladder. A deterministic assertion has no sampling error, so
it gates on a single run at one case or eight thousand, and
`deterministic-gates-cost-nothing-against-the-flake-budget` runs sixty of them without spending
a basis point.

`sixty-judged-gates-flake-by-construction` is the arithmetic nobody does. Judged criteria gated
individually at a 5% threshold produce false alarms by construction, and
`the-flake-budget-is-spent-per-judged-gate-and-is-a-hard-limit` walks the count until the budget
breaks. A gate that never flakes is either enormously expensive or insensitive; the point is to
state the budget rather than discover it.

`the-two-questions-demand-different-configurations` is the split that keeps a suite from being
flaky and blind at once. The property runs both questions against both configurations and
requires each to accept exactly one. `a-quality-claim-from-a-single-seed-is-refused` adds the
other half, and checks that "did it change" is *not* made to pay for seeds it does not need.

`an-undeclared-rerun-policy-is-p-hacking` is the cheapest rule here. Best-of-three chosen
beforehand is a design; one more try chosen after seeing red is not.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
