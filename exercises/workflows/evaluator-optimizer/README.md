# Evaluator–Optimizer Loops

**Tier:** drill — a self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part VI · Workflows Before Agents · Evaluator–Optimizer Loops](https://agentshonestly.com/book/workflows/evaluator-optimizer)

Two model calls in a loop, and three different reasons to leave it.

## The task

Implement `optimise(rounds, threshold, maxRounds)`, returning
`{ best, score, rounds, stopped }`.

The loop ends `converged` (score at or above the threshold), `stalled` (the evaluator
repeated its previous feedback), or `budget` (rounds ran out). `best` is the
highest-scoring draft actually reached, ties going to the earlier one.

**The stall check is what separates this from a plain retry loop.**
`repeated-feedback-stalls-the-loop` has the evaluator asking for citations twice in a
row. The optimiser did not act on the feedback — or acted and failed — and the third
round would have scored 90. It never runs, and that is the right call: an evaluator that
repeats itself is telling you the loop has stopped learning, and paying for two more
model calls to find out costs real money on every run that stalls, not just this one.

`alternating-feedback-does-not-count-as-a-stall` bounds the check honestly. Feedback that
cycles between two notes is still movement, and treating any repetition as a stall would
cut off loops that are genuinely converging in a zigzag.

`a-stall-returns-the-best-draft-not-the-last` and `running-out-of-rounds-returns-the-best-so-far`
are the same discipline as [Reflection](../../patterns/control/reflection): the loop
returns the best thing it reached, never the most recent. A revision that scored 30 after
one that scored 70 is not progress, and shipping it because it came last is the failure
mode of every iterate-until-done implementation.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
