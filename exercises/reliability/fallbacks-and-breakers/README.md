# Fallbacks and Circuit Breakers

**Tier:** drill. A self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part XVI · Reliability · Fallbacks and Circuit Breakers](https://agentshonestly.com/book/reliability/fallbacks-and-breakers)

The fallback worked perfectly. That is the problem.

## The task

Implement `serve(request, ladder)`, returning
`{ outcome, servedBy, degraded, attempted, skipped, error }`.

Walk the ladder in order. Skip a rung whose breaker is open, and skip a rung that may not
serve this risk tier, recording why in both cases. Call the rest: `ok` serves, `transient`
falls through, and anything else halts the ladder immediately. An exhausted ladder escalates.

## The property

`a-refusal-does-not-shop-for-another-provider` is the line that separates a fallback from a
workaround. The rung refused; every later rung is available and the ladder stops anyway.
Falling back on a content refusal is shopping for a provider that will comply, which is
building a bypass around a control. `a-malformed-request-fails-again-everywhere` is the
cheaper version of the same rule. The second attempt is the first attempt, somewhere else.

`high-stakes-work-is-not-allowed-to-degrade` and `tier-zero-work-may-use-the-cheap-rungs` are
the same three transient failures with two different answers. At tier 0 the smaller model
takes the work. At tier 2 the smaller model and the secondary provider are skipped entirely
and a person takes it, because when the choice is a worse answer or a slower one, an agent
that can hand work to a human has an option a pure inference pipeline does not. Escalating is
a first-class rung, not a last resort.

`degraded-is-true-exactly-when-something-other-than-the-first-rung-answered` is the field the
opening scene needed. Six days of `200 OK` from a secondary model that formatted tool
arguments slightly differently, and no dashboard that measured availability could have seen
it. Without recording which rung served, silent degradation is undetectable in principle,
not merely in practice.

`an-open-breaker-is-skipped-without-being-tried` is the entire value of the open state.
Ninety seconds of provider degradation becomes forty minutes of self-inflicted load only if
you keep calling; once open, the calls stop being made and the ladder moves on immediately.

`the-rungs-that-need-nobody-elses-capacity` is the one people plan for last. Everyone's
secondary is the same secondary and provider outages correlate, so the rungs guaranteed to be
there are reduced scope, queueing, and humans.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
