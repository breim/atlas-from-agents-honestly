# Failure Labs

**Tier:** build. This is a piece of Atlas. Self-contained, like every exercise here; the
narrative continues in the next build rather than the code.

**Chapter:** [Part XX · Capstone · Failure Labs](https://agentshonestly.com/book/capstone/failure-labs)

The review a lab has to pass before it counts as evidence.

## The task

Implement `assess(labs, policy)`, returning
`{ status, verdicts, admittedBypasses, attemptedBypasses }`.

A lab is invalid if it declares no fault, window or invariant; collects no evidence; inspects
only the return status; skips an isolation checkpoint; bounds something with no terminal
business policy; promotes its finding nowhere or to an unknown layer; or cleans up before
preserving its artifacts.

Count attempted bypasses separately from admitted ones. The suite is incomplete if any lab is
invalid **or** any bypass was admitted.

## The property

`an-attempted-bypass-and-an-admitted-one-are-counted-apart` is the distinction the whole chapter
turns on, and `an-admitted-bypass-makes-the-suite-incomplete-even-when-every-lab-is-valid` shows
why it has to be separate from lab validity. An attempted bypass is the control doing its job and
belongs in the report as a success. An admitted one is the incident. Collapse them into a single
"bypass" count and the number goes up when things get *better*.

`each-of-the-four-declarations-is-required-on-its-own` is the discipline that separates a lab from
an anecdote. Fault, window, invariant and evidence are declared before anything is injected,
because a fault injected without a stated invariant produces an observation nobody can argue
with or against.

`inspecting-only-the-return-status-is-always-refused` is the mistake with the largest blast
radius. The call returned an error and the money may still have moved; a lab that reads the
status and stops has confirmed nothing about the world.

`every-isolation-checkpoint-must-be-asserted-before` walks all three. Tenancy is not checked once
at the door. It is asserted before reranking, before prompt assembly, and at every graph hop,
because each of those is a place where a filter can silently stop applying.

`a-finding-is-promoted-to-a-known-layer-or-the-lab-is-invalid` is what stops the lab becoming the
only thing that catches a bug. Every finding moves down to the lowest layer that can prevent it,
and a lab that promotes nowhere guarantees the same finding next quarter.

`a-bound-with-no-terminal-policy-and-lost-artifacts-are-each-fatal-on-their-own` covers the two
endings. A bound that halts into nothing is a dead end nobody owns; artifacts cleaned up before
they are preserved mean the next run destroys the only evidence you had.

`an-invalid-lab-reports-no-promotion` keeps a failed lab from claiming credit for the fix it
never justified.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
