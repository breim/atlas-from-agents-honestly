# Cost and Latency as Scores

**Tier:** drill. A self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part XIV · Evals · Cost and Latency as Scores](https://agentshonestly.com/book/evals/cost-and-latency-evals)

A quality-only eval selects for expensive systems. It cannot do anything else.

## The task

Implement `evaluate(runs, config)`, returning the six reported numbers and three gates.

Cost per **outcome** is total spend over resolved runs: every cent on top, only the runs
that bought something on the bottom. Cost per **attempt** is total spend over all runs.
Latency measures `totalMs - humanWaitMs`, and `p95` is nearest-rank on the ascending sort:
index `ceil(95n/100) - 1`.

Three gates: quality against the baseline less the noise band, cost against the baseline
outcome cost plus 10%, and latency against all three budgets. A release passes only if all
three do.

## The property

`a-run-that-escalated-is-paid-for-and-bought-nothing` and
`an-expensive-release-that-works-costs-the-same-per-outcome` are the chapter's table, side by
side. Twenty cents a run against a hundred, five times cheaper on the invoice, and the same
one dollar per accepted outcome. The cheap one shipped nothing four times out of five; the
expensive one worked. Cost per attempt would have called the first a win, and it is generous
even so, because it ignores the cost of cleaning up four failed runs.

`a-failed-run-raises-cost-per-outcome-and-never-lowers-it` and
`cost-per-attempt-never-exceeds-cost-per-outcome` are that claim made general. A benchmark
that ignores failed runs will always make agents look cheaper than they are, and the gate is
on the honest meter while the flattering one is reported beside it. That way a release that
improves resolution cannot claim a cost win it did not earn, because the denominator moved,
and a release that quietly doubles escalations cannot hide behind a stable per-call figure.

`a-three-day-approval-is-not-latency` is the row that would otherwise invert the score. The
run took three days end to end, almost all of it waiting for a person to approve a refund.
That is the system working. Count it and the correct behaviour records as the worst result in
the suite, and `human-wait-is-never-counted-as-latency` proves adding a day of waiting to
every run changes nothing at all.

`p95-hides-the-tail-that-the-ceiling-catches` is why three latency scores rather than one.
Nineteen runs at five seconds and one at ninety: p95 reports five seconds and passes, and the
ceiling share is what fails the release. `a-fast-total-can-still-feel-broken` is the other
substitution: four seconds before the first token, five seconds total, and gating on total
alone would optimise the wrong half of the experience.

`a-cost-regression-fails-on-its-own` and `quality-one-step-below-the-band-fails` are why the
gates only work as a set. Quality alone rewards the cheat this chapter opens with: more
steps, a bigger model, sample and vote. Cost alone rewards answering quickly and badly.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
