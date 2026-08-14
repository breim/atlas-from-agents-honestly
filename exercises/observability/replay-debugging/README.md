# Replay-Driven Debugging

**Tier:** drill. A self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part XV · Observability · Replay-Driven Debugging](https://agentshonestly.com/book/observability/replay-debugging)

Replay holds the model constant to test your code. Divergence detection is what keeps it honest.

## The task

Implement `replay(recording, requests, config)`, returning
`{ status, responses, consumed, driftBps }`.

Check the serving slice once and exactly: a recording made under a different model or effort
is `stale`, and nothing is served. Then walk the requests against the recorded events. Drift
is the Jaccard distance over whitespace-separated tokens, in basis points; anything past
`thresholdBps` is `diverged`. A request with no event behind it is `exhausted`.

## The property

`a-model-upgrade-makes-every-recording-stale` is the case that justifies having two checks
instead of one. The prompts are byte-identical, so a prompt comparison sees nothing at all,
and every recorded response is worthless, because a different model generated them. A harness
that only compares prompts replays last month's recording against a new model and reports a
clean pass. `changing-the-effort-is-also-stale` is the same failure through the knob that
shapes generation rather than the model name.

`a-different-model-returns-nothing-whatever-the-prompts` holds that for every case in the
fixture, including the ones that otherwise replay perfectly.

`a-rebuilt-prompt-is-routed-to-re-run` is the other check, and it is what separates a replay
harness from a mock. A mock returns the recorded answer regardless; this reports that the
answer was generated for a different question and refuses to pretend otherwise. Returning it
would produce a result that looks valid and means nothing, which is worse than a failure,
because you would have believed it.

`a-small-wording-change-still-replays` is why the second check is a tolerance rather than an
equality. A policy id changed and the question is the same question; failing there would make
the technique unusable on any real fix.

`divergence-stops-at-the-first-bad-step` and `nothing-is-served-past-a-divergence`: once the
prompts have parted company, every subsequent recorded response is answering a conversation
that did not happen.

`asking-for-more-calls-than-were-recorded-is-exhausted` is deliberately a different status
from `diverged`. The code asked for a call the run never made, which is a fact about a
different bug.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
