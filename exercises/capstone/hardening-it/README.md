# Hardening It

**Tier:** build. This is a piece of Atlas. Self-contained, like every exercise here; the
narrative continues in the next build rather than the code.

**Chapter:** [Part XX · Capstone · Hardening It](https://agentshonestly.com/book/capstone/hardening-it)

The readiness check that turns "it works" into something you can defend.

## The task

Implement `harden(suite, policy)`, returning
`{ status, errors, gated, reported, flakeSpendBps, datasetSize }`.

The suite is soft if the dataset is missing any of its four sources, if an invariant carries a
threshold, if a **rate** is gated at all, if the gated rates spend more than the flake budget, if
the trace is missing any required field, if any required injection is absent, or if the security
review ran against the design rather than the built system.

## The property

`an-invariant-gates-and-a-rate-never-does` is the distinction that keeps a suite usable. An
invariant is a property that must hold, so it gates with no threshold at all. A rate is a
distribution, and gating it produces a red build that somebody re-runs until it goes green,
at which point the suite has stopped meaning anything.
`an-invariant-carrying-a-threshold-is-a-category-error` catches the other direction: a
"99% of the time tenants do not cross" invariant is not an invariant.

`the-flake-budget-is-spent-only-by-gated-rates` and `the-flake-budget-is-a-hard-limit` are the
arithmetic underneath. Every gated rate buys a false-alarm probability by construction, and the
budget is what stops the suite from being noisy enough to ignore. Invariants cost nothing, which
is the argument for moving criteria down the ladder.

`every-dataset-source-is-required-one-at-a-time` covers the four buckets, and two of them matter
for reasons worth naming. **Negatives** are a rare deterministic assertion in a probabilistic
field, because a case that must return nothing either returned nothing or it did not, so you take
every one available. **Promoted failures** compound: the corpus grows at exactly the rate the
system breaks, which beats any up-front sampling design, and a suite that never promotes one has
stopped learning.

`every-required-trace-field-is-required-on-its-own` is the redundancy signal. Three chapters each
demand the same four fields: the config hash, the retrieved chunk ids, who served the request,
and the user/agent/run triple. That overlap is why none of them is optional.

`every-required-injection-is-required-on-its-own` runs all six, including the two the chapter
singles out: the approval fast-forward and the wrong-result read cover bugs that are otherwise
found by a customer three days later.

`the-review-must-run-against-what-was-built` is the last line and the cheapest to skip. A review
against the design finds design flaws; every real finding is a control that existed with a gap
around its edge, and you can only see the edge on the built system.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
