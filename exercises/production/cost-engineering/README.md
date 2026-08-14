# Cost Engineering

**Tier:** drill — a self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part XVIII · Production · Cost Engineering](https://github.com/breim/agents-honestly/blob/main/content/docs/production/cost-engineering.mdx)

The instinct is to downgrade the model. It is almost always the wrong first move.

## The task

Implement `run(plan, budget, prices)`, returning the per-turn ledger and the split.

The context at turn *t* is the prefix plus `t-1` turns of history, capped by
`compactionCap` when one is set. Before each turn, decide: above the soft ratio the run
degrades to the cheaper rates; if the turn still does not fit inside the cap, it is not
taken and the run stops with what it has.

## The property

`doubling-the-turns-more-than-doubles-the-bill` is the arithmetic that reorders the whole
optimisation list. Four turns cost 177,000 micros; eight cost 474,000 — 2.68× the money for
2× the work, because the whole transcript is re-sent every turn and input tokens grow with
the square of the turn count. `doubling-the-turns-more-than-doubles-the-input` holds it as a
rule. Which is why cutting turns beats cutting the per-token price, and why tool granularity
and result design are cost decisions before they are quality ones.

`a-four-turn-run-spends-most-of-it-re-reading-itself` is the split that surprises people: 93%
of the bill is input. Output price is the bigger number per token and gets the attention;
input *volume* is what multiplies.

`compaction-caps-what-is-re-sent` is the same run with a ceiling on history — 343,500 instead
of 474,000, and the saving grows with every additional turn. That is a context-engineering
decision showing up on the invoice.

`the-soft-ratio-degrades-before-it-fails` and `without-degradation-the-run-stops-a-turn-sooner`
are the same budget twice. Degrading at 70% buys a fifth turn at cheaper rates; refusing to
degrade stops at four. A cost control that only knows how to fail is strictly worse than one
that knows how to spend less first — and neither of them is an error. The run finishes with
what it has.

`a-cap-below-the-first-turn-stops-before-spending-anything` is why the check runs *before* the
call. A refused turn is not billed, which is the difference between a budget and a report.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
