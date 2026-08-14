# ReAct Loop

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Control Patterns · ReAct Loop](https://agentshonestly.com/book/patterns/control/react-loop)

Reason, act, observe, repeat — with the observation actually going back in.

## The task

Implement `react(script, observations, maxSteps)`, returning `{ status, answer, transcript }`.

Each scripted step carries a `thought` plus either an `action` or an `answer`. Build the
transcript one entry per step:

- an action step records `{ thought, action, observation }`;
- an answering step records `{ thought }` and ends the run with `status: "answered"`;
- an unknown action observes `"error: no such action"` and the loop continues.

Running out of budget, or out of script, ends with `status: "bounded"` and no answer.

The property is the **interleaving**: every entry that has an `action` also has an
`observation`, and it is in the transcript before the next thought. That sounds
tautological until you write the loop that dispatches an action, appends the thought,
and forgets to append the result — at which point the model is reasoning about a tool
call whose output it never saw, and it will confabulate one. The test checks this
structurally, on every case, not just the ones that look interesting.

`the-bound-cuts-before-the-answering-step` is the off-by-one: with a budget of one, the
step that would have answered never runs.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
