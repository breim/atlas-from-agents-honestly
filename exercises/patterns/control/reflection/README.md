# Reflection

**Tier:** micro. One pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Control Patterns · Reflection](https://agentshonestly.com/book/patterns/control/reflection)

Let the model look at its own output and try again, but bound it, and keep the best attempt.

## The task

Implement `reflect(rounds, threshold, maxRounds)`, returning
`{ draft, score, rounds, stopped }`.

Consume rounds in order. Stop at the first score **at or above** the threshold
(`stopped: "threshold"`), or when the budget runs out (`stopped: "budget"`). Return the
**best draft seen**, ties going to the earlier one.

Best-seen, not last-seen, is the whole exercise. `revision-that-makes-things-worse-does-not-win`
scripts a `0.75` first draft revised into a `0.1`, which is what actually happens when
a model is told to improve something that was already fine. A loop that returns its
final iteration ships the `0.1` and reports success, because it ran the number of
rounds it was asked to run.

`rounds` counts what was consumed, so a run that stops early reports the smaller number.
That is the field you would put on a dashboard to find out whether reflection is
earning its cost.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
