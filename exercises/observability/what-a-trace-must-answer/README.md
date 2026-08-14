# What a Trace Must Answer

**Tier:** build — this is a piece of Atlas. Self-contained, like every exercise here; the
narrative continues in the next build rather than the code.

**Chapter:** [Part XIV · Observability · What a Trace Must Answer](https://github.com/breim/agents-honestly/blob/main/content/docs/observability/what-a-trace-must-answer.mdx)

Eight questions, a storage split, and a sampling rule.

## The task

Implement `record(run, policy, drawBps)`, returning
`{ status, unanswered, sampled, keptBecause, backendBytes, payloadBytes, warnings }`.

A trace is answerable only if some span carries every question the policy lists. Warn about a
truncation flag with no boundary, a stored payload with no content hash, a run with no
correlation id, and a backend footprint over budget.

Then decide whether to keep it: always for an interesting outcome, always for an outlier,
otherwise only when the draw falls inside the sample rate.

## The property

`every-one-of-the-eight-questions-is-required-on-its-own` strips each field in turn and requires
the trace to be reported incomplete, naming exactly that one. The expensive question is what was
in the window — large, different every turn, and the only one that explains the decision — and
it is the first thing dropped when instrumentation gets trimmed for cost.

`sampling-never-changes-whether-the-trace-could-answer-the-questions` keeps two different
decisions from getting tangled. Whether you *keep* a trace and whether it *could explain
anything* are independent; conflating them is how a sampling change quietly becomes a debugging
outage.

`anything-interesting-is-kept-regardless-of-the-draw` runs each always-keep outcome against
draws that would otherwise drop it. Escalations, errors and blocks are the runs you will
actually be asked about, and they are also the ones stratified sampling for online evals wants —
the same runs, so keep them once.
`an-outlier-is-kept-at-the-boundary-and-a-fast-run-is-not` and
`a-boring-run-is-kept-exactly-when-the-draw-falls-inside-the-rate` pin both thresholds at
`limit - 1`, `limit`, `limit + 1`.

`a-truncation-flag-with-no-boundary-is-warned` is the finding with the highest ratio of value to
effort in this chapter. Without the boundary, an answer that failed because a field was cut is
indistinguishable from one that failed because the model ignored it — and that is the difference
between fixing a tool and rewriting a prompt. The test checks the warning appears and then
disappears once the boundary is recorded.

`every-stored-payload-carries-a-hash-and-an-empty-one-needs-none` is the storage split doing two
jobs at once: the hash is the join key between the observability backend and the object store,
and it is the integrity check on the copy. `the-backend-holds-metadata-and-the-payload-store-holds-the-bytes`
asserts the split actually bought something — payload bytes exceed backend bytes — because a
single agentic request produces hundreds of spans and web-request instrumentation habits cost an
order of magnitude more here.

`a-run-with-no-correlation-id-joins-to-nothing` is the cheapest decision with the widest reach.
Use the business entity and the trace, the event history, the eval score, the audit record and
the ticket all join without a mapping table.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
