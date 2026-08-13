# Bounded Autonomy

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Control Patterns · Bounded Autonomy](https://github.com/breim/agents-honestly/blob/main/content/docs/patterns/control/bounded-autonomy.mdx)

Freedom inside a box you drew, rather than trust you keep re-evaluating.

## The task

Implement `enforce(actions, budget)`, returning `{ allowed, denied }`.

Three independent bounds, checked in this order:

1. `tool_not_granted` — the tool is outside the grant;
2. `action_budget_exhausted` — the action count is spent;
3. `spend_budget_exhausted` — the money is spent.

Spending exactly the remaining budget is allowed; one cent more is not.

The property that matters is **a denial consumes nothing**. `a-denial-consumes-no-budget`
sends a forbidden tool first, then two legitimate actions that both fit — and both must
run. An implementation that decrements the counter before checking the grant turns one
refused action into a starved agent, and the failure looks like the budget being wrong
rather than the check being in the wrong place.

Ordering scope before spend matters for the same reason `scope-is-checked-before-spend`
exists: an action the agent was never allowed to take should be refused for *that*
reason, not for being expensive. The reason code is what a person reads at 3am.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
