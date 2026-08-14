# Why Your Agent Is Flaky

**Tier:** drill — a self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part I · The Model as an Interface · Why Your Agent Is Flaky](https://agentshonestly.com/book/foundations/nondeterminism)

Sample the same prompt several times and measure what you actually got.

## The task

Implement `analyse(samples, consensusBps)`, returning
`{ modal, modalCount, samples, agreementBps, stable }`.

`agreementBps` is how often the most common answer appeared, in basis points, rounded
with `floor(x + 0.5)`. Ties on the modal answer break **lexicographically** — a report
about nondeterminism that is itself nondeterministic is not a report. `stable` is
agreement at or above the bar; `a-supermajority-is-stable` sits exactly on it.

Two things this measures, and one it does not.

`a-bare-majority-is-not-consensus` is three out of five. The modal answer is right there
and the agent disagrees with itself two times in five. Shipping on "the majority said
refund" means one run in three does something else, and the run that does something else
is the one that ends up in a ticket.

`one-sample-agrees-with-itself` returns 100% agreement and `stable: true`, and it is the
most misleading output this function can produce. One sample always agrees with itself.
That is not evidence of determinism, it is the absence of measurement — and it is exactly
what you have when you tested a prompt by running it once and it looked fine.

What this does **not** measure is correctness. Five identical wrong answers score 10000
and pass. Stability and quality are different axes, and the golden set is the other one.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
