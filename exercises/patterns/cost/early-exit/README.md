# Early Exit

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Cost Patterns · Early Exit](https://agentshonestly.com/book/patterns/cost/early-exit)

Stop at the first stage that answers the question, not at the end of the pipeline.

## The task

Implement `run(stages, verdicts, execute)`, returning `{ settledBy, ran, spent }`.

Run stages in order. A stage returning `settled` ends the pipeline. The last stage
settles whatever it says — there is nothing after it. `ran` lists the stages that
actually executed and `spent` is their total cost.

`ran` is checked against a counting spy, which is the point. An implementation that runs
every stage and *then* picks the first settled verdict produces the correct `settledBy`
and the wrong bill — and the bill is the only reason the pattern exists. That failure is
invisible in the output and shows up a month later as a cost line nobody can explain.

The cost curve is why the cheap stages go first. `the-free-stage-settles-it` costs
nothing; `settling-late-costs-everything-before-it` costs 106, which is *more* than
calling the large model directly. Same trade as [Model Cascade](../model-cascade): the
pipeline is a bet that most questions are settled early, and if they are not, the extra
stages are pure overhead.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
