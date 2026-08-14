# Critic and Reviser

**Tier:** micro. One pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Control Patterns · Critic and Reviser](https://agentshonestly.com/book/patterns/control/critic-reviser)

One role finds problems, another fixes them, and something neutral decides whether the fix was one.

## The task

Implement `revise(draft, rounds)`, returning `{ draft, accepted, rejected }`.

Each round proposes a new draft with the findings it `resolves` and the ones it
`introduces`. Accept it only when it **resolves at least one finding and introduces
none**. Otherwise the incumbent draft stands. Either way the loop continues to the next
round.

`a-trade-off-revision-is-still-a-rejection` is the case with an opinion in it. A revision
that fixes tone and length while introducing an accuracy problem is *rejected*, even
though it fixed two things and broke one. Counting findings and taking the better number
lets a reviser trade a cosmetic fix for a factual regression, and the arithmetic will
say it improved.

`a-rejected-revision-does-not-end-the-loop` is the other half: a bad revision is not a
terminal state. The reviser gets to try again, it just does not get to overwrite
something better in the meantime.

Note what is not here: the critic's findings are given, not computed. Judging whether
the critique itself was any good is an eval, and it belongs in Part XIV rather than in
the control flow.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
