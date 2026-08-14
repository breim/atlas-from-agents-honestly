# Escalation Ladder

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Control Patterns · Escalation Ladder](https://agentshonestly.com/book/patterns/control/escalation-ladder)

Start at the cheapest thing that could work, and climb only when it does not.

## The task

Implement `escalate(kind, ladder, outcomes)`, returning `{ path, resolved, cost }`.

Rungs are ordered cheapest first. Enter at the lowest rung whose `handles` list contains
the request kind, and climb to the next **capable** rung on each failure. `outcomes`
scripts what each attempt returns. Cost accumulates over every rung actually attempted —
including the ones that failed, because a failed attempt still cost what it cost.

Two properties:

- **The path is strictly ascending.** A ladder that can descend is not a ladder; it is a
  retry loop that happens to be labelled with seniority, and it will bounce a hard case
  between two rungs forever.
- **Rungs that cannot handle the kind are skipped, not attempted and failed.**
  `skips-rungs-that-cannot-handle-the-request` sends a refund and never touches the
  canned rung. Attempting it first would cost nothing here and, in a real ladder, would
  spend a model call to discover something the routing table already knew.

`a-request-nothing-handles-never-starts` is the honest empty case: no capable rung means
no attempt, cost zero, unresolved. Not an exception — a request the ladder cannot serve
is information, and something upstream needs it.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
