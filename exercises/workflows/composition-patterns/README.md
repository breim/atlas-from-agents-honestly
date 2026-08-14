# Sequential, Parallel, Fan-Out

**Tier:** drill. A self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part VI · Workflows Before Agents · Sequential, Parallel, Fan-Out](https://agentshonestly.com/book/workflows/composition-patterns)

Three shapes over the same steps, and the wall clock each one buys you.

## The task

Implement `compose(steps, mode, limit)`, returning `{ results, failed, elapsed }`.

- **sequential.** Elapsed is the sum.
- **parallel.** Elapsed is the slowest step.
- **fanout.** Parallel under a concurrency cap, so elapsed is the sum of each wave's
  slowest step.

`results` holds the ids that succeeded, `failed` the rest, **both in declaration order**.

`results-follow-declaration-order-not-completion-order` is the property that survives the
shape. A hundred-millisecond step and a one-millisecond step finish in the opposite order
to how they were declared, and the output does not reflect that. Correlating a result to
its input by position is the cheapest correct thing a caller can do, and completion order
takes it away for no benefit.

`a-failing-step-does-not-stop-its-siblings` and its sequential twin are the other
invariant. A failure is recorded and the composition continues, including in
`sequential`, where the temptation to abort is strongest and where aborting throws away
work that had nothing to do with the failure.

The elapsed arithmetic is the reason to write this out rather than reason about it. Three
steps of 30, 20 and 10 milliseconds cost **60** sequentially, **30** in parallel, and
**40** fanned out two at a time. Fan-out is a distinct point on the curve rather than
"parallel but safer", and the cap you choose is visible right there in the number.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
