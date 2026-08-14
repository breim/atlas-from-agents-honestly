# The Loop, By Hand

**Tier:** build — this is a piece of Atlas. Self-contained, like every exercise here; the
narrative continues in the next build rather than the code.

**Chapter:** [Part II · From LLM to Agent · The Loop, By Hand](https://agentshonestly.com/book/first-agent/the-loop-by-hand)

Atlas v0. Change the `if` to a `while` and everything the `while` drags in behind it.

## The task

Implement `run(ticket, script, config, world)`, returning an outcome with a `status` of
`answered`, `escalated`, or `halted`.

Loop up to `maxSteps`. Before each call, check the cost and the deadline. Take the next
scripted response, charge its cost and its time, and record the step. If the model stopped
asking, it answered. If it asked for `escalate_to_human`, it handed off. Otherwise run every
tool it requested, append the results, and go again. If the loop runs out of steps, halt.

A tool resolves against `world.catalogue` and `world.records`, exactly as in the previous
build, plus two things: results are truncated to `maxResultChars`, and a record belonging to
another customer is refused. A record with a `customerId` of `null` is not customer-scoped.

The model is scripted, the clock is injected, and cost is in whole cents. Everything you are
building is the boundary conditions.

## The property

`a-budget-is-checked-before-the-call-not-after` is the chapter's sharpest sentence turned into
a test. The cap is 5 cents; the run ends having spent 6. That is not a bug. The check happens
before each call, so a step that starts inside the budget is allowed to finish, and the step
that would have started at 6 cents never runs. Reordering those two lines is the difference
between a limit and a report, and `no-step-is-ever-started-once-a-bound-is-already-crossed`
proves it for every case at once by replaying the script's own costs and timings.

`the-step-cap-halts-a-loop-that-will-not-converge` and `the-deadline-halts-a-run-that-is-merely-slow`
are the other two bounds you own. In all three, `an-unreachable-answer-is-never-reached` checks
the thing that makes those fixtures mean anything: the script always contains an `end_turn`
that the run never got to. Without that, a halt test proves nothing.

`a-halted-run-never-carries-an-answer` is the chapter's "single most common bug" as an
assertion. Falling out of the bottom of the loop and returning the last text lying around
converts *the agent could not finish* into *the agent finished*, silently. That is how a queue
fills with tickets marked handled that nobody handled. Halting names a bound and carries no
reply, so it routes to a human exactly like an escalation does — and the difference between
the two is worth tracking, because an escalation is the agent working and a halt is the agent
failing.

`a-terminal-tool-cancels-the-turn-it-was-in` is a detail that only shows up once the model can
issue several calls per turn. The model asked for `get_order` and `escalate_to_human` together;
the handoff wins and `get_order` never runs. `a-model-that-never-stops-is-stopped-by-the-cap`
feeds it forty identical tool requests and gets exactly five steps back.

`a-tool-refuses-data-that-belongs-to-another-customer` is authorization where it belongs. The
model picks the arguments, so a model that has read a document mentioning account 5500 will
ask for account 5500. The refusal is a parameter your tool enforces, never a line in a prompt.
The property runs the *whole Acme trace* as a different customer and asserts that nothing
customer-scoped comes back.

`the-history-grows-by-two-messages-per-tool-step` is the cost curve as arithmetic. Step 1 sends
1 message, step 2 sends 3, step 3 sends 5 — every one of them resent in full, on every request,
for one user-visible reply.

`an-answer-on-the-first-step-needs-no-tool-at-all` looks trivial and is not: it is the only case
where the loop terminates before any tool runs, and without it a subtly wrong stopping condition
passes everything else.

## A note on `steps`

`steps` here is the number of model calls actually made, so a run that halts on cost after two
calls reports `steps: 2`. The chapter's snippet returns the loop index instead, which reports
`3` for the same run. Counting completed calls is what makes `steps` agree with the trace, the
cost, and the elapsed time.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
