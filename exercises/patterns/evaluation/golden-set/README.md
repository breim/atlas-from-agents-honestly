# Golden Set

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Evaluation Patterns · Golden Set](https://agentshonestly.com/book/patterns/evaluation/golden-set)

A frozen set of cases whose answers you already know.

## The task

Implement `score(golden, answers)`, returning `{ passed, failed, missing, rate }`.

Every case in the golden set is judged. A case with no answer is **failed and listed in
`missing`** — it appears in both. An answer for a case that is not in the set is ignored.
Matching is exact. `rate` is `passed / total`, rounded to four places with
`floor(x + 0.5)`.

`an-unanswered-case-is-a-failure-not-an-omission` is the property. The denominator is the
golden set, never the answers. An implementation that iterates the answers instead reports
100% for a run that skipped a third of the suite — and the pass rate goes *up* as coverage
goes down, which is the most dangerous possible direction for that number to move. It is
also exactly what happens when a case starts throwing and someone adds a `try/catch`.

`missing` exists separately because the two failures need different responses. A wrong
answer is a quality regression. An unanswered case is a broken harness, and no amount of
prompt work will fix it.

`matching-is-exact-not-fuzzy` keeps the scorer honest: `"Refund"` and `"status "` fail.
A golden set that normalises whitespace and casing is making a judgement call about what
counts as correct, and that judgement belongs in the expected values where it is visible.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
