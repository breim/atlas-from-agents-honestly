# Approval Gates

**Tier:** build. This is a piece of Atlas. Self-contained, like every exercise here; the
narrative continues in the next build rather than the code.

**Chapter:** [Part XII · Human in the Loop · Approval Gates](https://agentshonestly.com/book/human-in-the-loop/approval-gates)

Three decisions make a gate. Most teams decide only the first.

## The task

Implement `gate(spec, decision, presentedAtMs, policy)`, returning
`{ status, errors, next, applied, staleBy }`.

Validate the gate before looking at the decision, and report every problem: more or fewer than
one side-effecting call, a required disclosure missing, fewer than the four answers, an expiry
that outlives the data's volatility, or an execution gate in the fast lane.

Then judge the decision. Past its validity it is rejected and goes back for revision. A denial
needs a reason; an edit needs a correction. Approve and edit **act**, with an edit applying the
correction rather than the original. Deny **revises**, and escalate **halts**.

## The property

`an-edit-is-what-reviewers-actually-want` is the answer most gates do not offer, and the
assertion has teeth: what reaches the world is the reviewer's corrected call, explicitly *not*
the one the agent proposed. Without it, a reviewer who would have approved $1,800 instead of
$4,200 has to deny, and a real correction is recorded as a rejection.
`a-gate-with-only-approve-and-deny-is-refused` and the property that removes each answer in turn
make the four-answer rule structural rather than advisory.

`a-decision-past-its-validity-is-rejected-before-it-is-recorded` is why this is an update rather
than a signal. An approval is a decision about a state, and the state moves, so the reviewer
learns their answer was too late instead of it landing silently on data that has changed.
`expiry-is-enforced-at-the-boundary-and-staleness-is-measured` checks `window - 1`, `window`,
`window + 1`, and `a-stale-decision-is-never-applied-whatever-the-answer-was` closes the door
for all four answers rather than just the dangerous-looking one.

`an-expiry-that-outlives-the-data-is-refused` is the gate-design half of the same idea: the
expiry is set from volatility, and a two-hour window over data that moves every fifteen minutes
is a gate that approves the past.

`a-gate-holding-two-side-effects-is-refused` carries the mechanic from the persistence chapter
into the design rule. A resume re-executes the node from the top, so anything sharing the node
with the approval fires twice. The property tests zero, one, two and three calls, because "at
most one" and "exactly one" are different rules and only the second is safe.

`a-gate-that-hides-a-material-fact-is-refused` removes each required disclosure one at a time.
A reviewer without the evidence, the authority, or the limits on reversal is not checking
anything; they are being persuaded, and you have added latency without oversight.

`a-denial-carries-an-instruction-and-branches` is the deny path as a branch rather than an end
state, with a reason written as something the model can act on, so the run revises instead of
dying. `only-an-approval-or-an-edit-ever-reaches-the-world` states the converse over every case.

`an-execution-gate-in-the-fast-lane-is-refused` is the queueing decision: one mixed queue gives
deliberate decisions the fast lane's attention, which is how a credit gets waved through in the
time meant for a triage label.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
