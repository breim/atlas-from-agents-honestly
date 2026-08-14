# Detecting Drift

**Tier:** drill — a self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part XV · Observability · Detecting Drift](https://agentshonestly.com/book/observability/drift)

The question is not what broke. It is which of four things changed.

## The task

Implement `diagnose(window, thresholds)`, returning `{ cause, tripped }`.

`tripped` lists every signal past its threshold. `cause` routes the window to one diagnosis,
in this order: a deploy in the window, then the frozen canary, then cited-chunk turnover,
then input drift **and** an evaluator drop together, then format compliance. Nothing else is
a cause.

Deltas are signed against a trailing baseline, in basis points. A threshold reached exactly
is reached.

## The property

`the-deploy-log-comes-first` is deliberately the loudest window in the fixture. Canary down,
corpus turned over, inputs shifted, evals down, format compliance down — six signals, and the
answer is still that you shipped something. `a-deploy-in-the-window-outranks-every-other-signal`
holds it for every case. "You" is the most common answer and the last one anyone checks,
which is why the check is first rather than thorough.

`a-frozen-canary-that-moved-is-the-provider` is the only instrument in the chapter that can
isolate a single cause, and it works by subtraction. The inputs were fixed and the config was
pinned, so nothing you own can explain the drop. That also means the canary must be genuinely
frozen: fixtures updated when they start failing are not canaries, they are a ratchet.

`input-drift-alone-is-not-an-alert` and `an-eval-drop-alone-is-not-an-alert` are the two
halves, and `the-pair-is-the-alert` is why they are only useful together. Traffic legitimately
changes every week and most of it is fine; eval scores are noisy on small samples. Either
signal has a base rate too high to page on. Their conjunction does not, and
`the-joint-alert-needs-both-halves` proves neither half can fire it alone.

`a-re-index-displaced-the-chunk-that-answered-the-question` is the chapter's actual ending:
three weeks of slow decline, no deploy, no model change, no user change. A batch of newly
ingested documents displaced the chunk that answered the most common question. The signal is
free — you are already recording cited chunk IDs for replay and incident scoping — but only
if someone is watching it.

`getting-better-is-not-drift` is why the deltas are signed rather than absolute. A canary
that improved by eight points is not an incident.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
