# Judge With Rubric

**Tier:** micro. One pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Evaluation Patterns · Judge With Rubric](https://agentshonestly.com/book/patterns/evaluation/judge-with-rubric)

"Rate this answer out of ten" is not an eval. A rubric is.

## The task

Implement `judge(scores, rubric, threshold)`, returning
`{ total, verdict, unaddressed, vetoed }`.

`total` is the weighted mean of the criteria, rounded with `floor(x + 0.5)`. A criterion
the judge never scored counts as **zero** and is listed in `unaddressed`. A criterion
below its `min` is listed in `vetoed` and fails the verdict whatever the total says.
Scores for criteria outside the rubric are ignored.

`an-unaddressed-criterion-scores-zero` is the property. The denominator is the rubric,
never the scores that came back. A judge that quietly drops the criteria it did not
address gives a *higher* total for a *less* thorough evaluation, and since the missing
criterion is usually the one that was hard to assess, the rubric ends up silently
measuring only the easy parts.

`a-veto-beats-a-high-total` is why a weighted mean alone is not enough. The answer scores
75 overall and is not grounded. Averaging lets a fluent, well-toned, complete fabrication
outscore a terse correct answer, which is exactly the failure mode LLM judges are known
for. Some criteria are gates, not contributions.

`a-perfect-score-on-the-lightest-criterion-does-not-rescue` is the same argument in the
other direction: full marks on the weight-1 criterion moves the total by seventeen points
and does not reach the bar.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
