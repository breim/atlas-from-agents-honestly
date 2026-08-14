# Scoring

**Tier:** drill — a self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part XIV · Evals · Scoring](https://github.com/breim/agents-honestly/blob/main/content/docs/evals/scoring.mdx)

Run both orderings. Count only consistent wins.

## The task

Implement `compare(trials)`, returning
`{ a, b, winner, inconsistent, consistencyBps, positionBias }`.

Each trial was judged twice: `forward` is the pick with A shown first, `reverse` the pick
with B shown first. A trial counts as a win only when the same candidate takes both
orderings. A trial that flipped goes into `inconsistent` and toward `positionBias` — `first`
when the judge took whichever option came first, `second` when it took whichever came second.

`consistencyBps` is the share of trials that agreed with themselves, in basis points, using
`floor(x + 0.5)`.

## The property

`a-judge-that-always-picks-the-first-option-wins-nothing` is the case the technique exists
for. Four trials, and in every one the judge picked A when A came first and B when B came
first. Score only the forward pass and you get a clean 4–0 for A — a confident number that
measures the order of the arguments. Run both and the count is 0–0, which is the honest
answer: this judge said nothing about these candidates. Position inconsistency is reported at
around 40% in the literature, so this is not a corner case.

`which-candidate-you-call-a-does-not-change-what-the-judge-did` is the same claim made
generally. Relabel the candidates — which also swaps which ordering is the forward one — and
the wins swap, while `inconsistent`, `consistencyBps`, and `positionBias` do not move at all.
Bias belongs to the judge, not to the labelling, and a scorer whose bias figures change when
you rename A is measuring the wrong thing.

`discarding-a-flipped-trial-never-changes-who-won` is why throwing the flips away is safe
rather than wasteful. They were never carrying a result.

Note what this returns and what it does not. There is a `winner` and there is no verdict.
Pairwise reaches higher human agreement than absolute scoring because a relative comparison
is easier than an absolute calibration — and that same relativity is why **you cannot gate a
release on it**. "B beat A" says nothing about whether either is acceptable. Pairwise is for
choosing between candidates; a rubric is for deciding whether to ship.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
