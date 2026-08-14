# Failure Injection

**Tier:** drill — a self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part XVI · Reliability · Failure Injection](https://agentshonestly.com/book/reliability/failure-injection)

An untested recovery path is a hypothesis, and it is usually wrong.

## The task

Implement `check(run, caps)`, returning `{ violations, held, passed }`.

Six invariants, asserted after every injected fault, always in the same order: the run
reached a terminal state, no external effect happened twice, cost and turns stayed under the
cap, anything unresolvable escalated **with a reason**, the injected fault and the recovery
are both on the trace, and no tenancy, taint, or authorization boundary was crossed.

## The property

`a-fault-handled-correctly-and-expensively` is why the assertion is not "no exception was
thrown". The run completed, issued exactly one credit, escalated nothing it needed to, and
cost four times its cap. It was retried, fallen back, and re-planned into a result that
passes every check a human would think to write, and it quadrupled the bill on a code path
that runs only when something has already gone wrong.

`the-fallback-path-forgot-the-tenant` is why `contained` is on the list. Degradation is
exactly when boundaries get skipped, and a fallback that drops the tenant is a cross-tenant
bug that appears only during an incident — which is to say, only when nobody has time to look
at it.

`an-injected-fault-that-looks-like-a-real-one` is small and load-bearing. Without the fault
on the trace, an injected failure and a genuine one are indistinguishable in your dashboards,
and a game day generates a real page.

`killing-between-the-effect-and-the-record-issued-two-credits` is the entire reason the dedup
table exists, found in one run — and found by *counting* effects rather than reading them
back from a log.

Then the two that end the chapter. `a-wrong-result-the-re-derivation-caught` is the injection
working: a tool returned a plausible, well-formed, wrong total, the amount failed to re-derive
from the order, and the run escalated with the reason attached. One wrong-result injection
exercises re-read discipline, amount re-derivation, grounding checks, and risk-tier
computation at once, and no error-shaped fault exercises any of them.

`the-invariants-all-hold-and-the-answer-is-wrong` is the honest one. Terminal, no duplicate,
under budget, nothing to escalate, fully traced, fully contained — six for six, `passed: true`,
and the customer got a confident wrong answer. `whether-the-answer-was-right-is-not-an-input`
proves the instrument is blind to it by construction: flipping `answerCorrect` on any run
changes nothing. That is the semantic class, it has no exception type, and this part of the
book has nothing to catch it with. The eval suite does.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
