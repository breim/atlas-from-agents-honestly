# Canary Eval

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Evaluation Patterns · Canary Eval](https://agentshonestly.com/book/patterns/evaluation/canary-eval)

Give the candidate a slice of real traffic and decide from what comes back.

## The task

Implement `decide(samples, rate, policy)`, returning `{ action, reason }`.

- Fewer than `minSamples` → `hold` / `insufficient_samples`.
- Otherwise: `rate >= baseline` → `promote`; `rate >= baseline - tolerance` → `hold`;
  below that → `rollback`.

The property is that **`hold` is the default under uncertainty, in both directions**.
`too-few-samples-holds-whatever-the-rate` and
`too-few-samples-holds-even-when-the-rate-is-terrible` are the same case with opposite
numbers, and they exist because implementations get one of them right and the other
wrong. Ten samples at 99% is not evidence of quality — it is ten samples. Ten samples at
10% is not evidence of failure either, and rolling back on it means your deploy process
is driven by noise.

That symmetry is uncomfortable. It means a genuinely broken candidate keeps serving its
slice until the sample floor is reached, which is why the slice is small and the floor is
low. A canary is a statistical instrument; using it before it has data is not caution,
it is a coin flip with extra steps.

`a-small-regression-inside-tolerance-holds` is the third state earning its place. The
candidate is worse but not alarmingly so — neither promote nor rollback is right, and
collapsing to a binary forces one of two wrong answers.

Rates are **basis points**, integers out of 10000, and that is not incidental. In
floating point `0.9 - 0.05` is `0.8500000000000001`, so a candidate sitting exactly on
the tolerance floor rolls back — in both languages, for no reason anyone intended, and
only on the boundary case nobody tests by hand. Comparisons that gate a deploy should not
be done in floats.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
