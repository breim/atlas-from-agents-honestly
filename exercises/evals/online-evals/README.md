# Online Evals and Guardrails

**Tier:** drill — a self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part XIV · Evals · Online Evals and Guardrails](https://agentshonestly.com/book/evals/online-evals)

Production has the sample size CI cannot afford. It also has side effects.

## The task

Implement `plan(runs, policy)`, returning `{ scored, rateBps, writes }`.

A run is scored if its position is a multiple of `baselineEveryNth`, or if it matches any
stratum in `policy.always`. Report the achieved rate per stratum, plus `plain` for runs
matching none and `overall` for everything, in basis points.

Then the write accounting: a run that requested a write had that path validated only if it
ran at `canary` or `production`. A `shadow` run's write is `unvalidated`.

## The property

`shadow-cannot-validate-a-write` is the boundary that general shadow-testing guidance does
not have to think about. The usual advice assumes the shadowed system is a function: same
input, compare outputs, no consequences. An agent has side effects, so a shadowed agent runs
with **writes disabled** — which means you are shadowing a different system than the one you
will ship. It proves the reads, the tool selection, and the decisions. It cannot prove
`issue_credit`, and it never will, because the whole point of shadow is that nothing happens.

`promoting-shadow-traffic-to-canary-is-what-closes-the-write-gap` is the consequence: canary
is non-optional for any agent that moves money, however clean the shadow results look. The
write path is validated with real consequences and a small blast radius, or it is not
validated.

`every-escalation-is-scored-whatever-the-baseline-says` is the other half. You cannot judge
every turn — the judge-cost arithmetic that caps golden sets applies with more force to
unbounded traffic — so online scoring is stratified sampling, and the stratification is where
the value is. A flat 20% sample would have looked at one escalation in five; this plan looks
at all of them, and
`a-non-empty-failure-stratum-is-never-sampled-less-than-plain-traffic` holds it to that.

`a-flagged-run-that-is-also-a-baseline-hit-is-scored-once` and
`a-run-can-match-more-than-one-stratum` keep the arithmetic honest: overlapping strata are
reasons to look, not reasons to double-count.

The sampling is systematic by position rather than random. That is a deliberate choice for a
drill — the same traffic yields the same plan, which is what makes any of this testable.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
