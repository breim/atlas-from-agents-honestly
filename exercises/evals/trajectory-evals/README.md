# Evaluating the Path, Not Just the Answer

**Tier:** drill. A self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part XIV · Evals · Evaluating the Path, Not Just the Answer](https://agentshonestly.com/book/evals/trajectory-evals)

Score the path without specifying it.

## The task

Implement `score(calls, spec)`, returning six basis-point numbers plus
`policyViolations`.

Recall and precision are over the **set** of tools called. Step efficiency is
`minimumSteps` over the actual count, capped at 10000. Redundancy is the share of calls that
contributed nothing. Loop escape is 10000 minus the share of calls that repeat an earlier
call's exact `(tool, args, error)` triple **and** carry an error. A policy pair
`[before, after]` is violated when `after` appears with no `before` ahead of it.

## The property

`order-that-is-not-policy-is-not-scored` is the row that took discipline to leave empty, and
`reordering-calls-no-policy-names-changes-nothing-that-is-scored` is it as a rule. The entire
reason to build an agent is that it chooses the sequence after seeing each result. An eval
that demands one exact sequence has re-specified a fixed workflow and is now failing the
agent for doing the thing you built it to do, and if the sequence really is fixed, it should
have been a workflow.

`refunding-before-verifying-is-a-policy-violation` is the exception, and the run scores
perfectly on everything else: right tools, no waste, right answer. Order is policy here, and
reversing it is a compliance failure regardless of outcome. `an-effect-with-no-decision-at-all-is-a-violation`
closes the other half. A missing gate is not a late gate.

`retrying-the-same-bad-call-is-a-loop` is the case an answer-only score and a tool-set score
both mark as fine. Recall is 10000 and precision is 10000, because `get_order` was exactly
the right tool to call. It called it five times, with the same argument, getting the same
error, and did nothing with any of them. A low loop-escape score points at error text that
selects no branch. A repeated identical `(tool, args, error)` triple is a control-flow
signal, not a message problem.

`fixing-the-argument-the-error-named-is-not-a-loop` is what recovery looks like from the same
instrument, and it is why the triple includes the arguments.

`a-missing-lookup-is-a-recall-failure` is the dangerous direction, and the case is built to
show why: the run took two steps against a minimum of three and still scores full step
efficiency, because you cannot detect skipped work by counting steps. Recall catches it.
Optimise recall first. Precision failures show up on a cost dashboard, recall failures show
up in a customer complaint.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
