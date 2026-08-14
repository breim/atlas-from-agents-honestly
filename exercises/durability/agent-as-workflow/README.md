# The Agent as a Workflow

**Tier:** build — this is a piece of Atlas. Self-contained, like every exercise here; the
narrative continues in the next build rather than the code.

**Chapter:** [Part XI · Durability in Practice · The Agent as a Workflow](https://github.com/breim/agents-honestly/blob/main/content/docs/durability/agent-as-workflow.mdx)

Atlas v0 ported, and the five latent bugs the port forces you to fix.

## The task

Implement `port(plan, bounds, workflowId, config)`, returning
`{ status, errors, historyBytes, activities, bounds }`.

Check the placement of every step and report **every** problem, not the first: an effect left in
workflow code, a step that reads the clock, an activity returning more than `maxPayloadBytes`,
a model activity that will be double billed, and a history that outgrows `maxHistoryBytes`.

Give every activity an idempotency key derived from the workflow id. Report which of the v0
bounds are still yours and which moved to the platform.

## The property

`a-model-call-in-workflow-code-is-rejected` is the one rule the whole layout follows from. The
property version runs each effect kind **both ways** and requires the workflow placement refused
and the activity placement accepted — the problem is never the operation, it is the side of the
split it sits on.

`the-deadline-cannot-read-the-clock` is the bound that changes hands. In v0 the loop checked
elapsed time itself; workflow code cannot, so the deadline becomes a run timeout the server
enforces — which is strictly better, because it still fires when the worker is wedged and the
self-check would never have run. `the-clock-is-never-allowed-in-workflow-code-and-the-deadline-is-the-platform`
also pins what did *not* move: the step cap and the cost cap are still yours.

`a-model-activity-that-does-not-heartbeat-is-billed-twice` is the failure with an invoice
attached. A slow model call that never heartbeats is declared timed out and retried while the
first one is still running, so you buy the same completion twice.
`a-fast-model-activity-without-a-heartbeat-is-fine` is the control that keeps the rule precise,
and `heartbeating-is-what-fixes-it-not-shortening-the-timeout` shows the actual remedy.

`an-oversized-return-value-is-journalled-forever` is why truncation moves *inside* the activity.
Whatever an activity returns is written to the event history and kept, so projecting after the
call is too late. The property checks the boundary at `cap - 1`, `cap`, `cap + 1`.
`a-transcript-that-outgrows-the-history-is-rejected` is the same arithmetic at run scale: five
substantial turns and you are past the history budget, which is when you start holding a
reference and a cursor instead of the messages.

`the-key-is-stable-for-one-execution-and-different-for-another` is the part that got *easier*.
Idempotency keys were discipline in Part VIII; here the workflow id is stable by construction,
so the key is correct without anyone remembering to make it so.

`a-rejected-plan-says-every-reason-not-just-the-first` matters because these are review-time
findings — a port with three placement bugs should surface three, not send you round the loop
three times.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
