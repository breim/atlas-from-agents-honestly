# Approval Gate

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Durability Patterns · Approval Gate](https://agentshonestly.com/book/patterns/durability/approval-gate)

A human said yes to one specific thing, at one specific time.

## The task

Implement `gate(action, approval, now)`, returning `{ allowed, reason }`.

The canonical hash of an action is `tool|account|cents`. An approval allows the effect
only when its hash equals the action's **and** `now < expiresAt`. Missing approval,
mismatched hash, and expiry each have their own reason code, checked in that order.

The property is **binding**: an approval authorises one action, not a category.
`an-approval-for-a-different-amount-is-refused` is the case that matters most — same
tool, same account, `500` approved and `9000` attempted. Every gate that checks "is
there an approval for this run?" instead of "is there an approval for *this action*?"
allows it, and the audit log will show a human approving a refund they never saw.

Expiry is exclusive: at exactly `expiresAt` the approval is dead. A gate evaluated at
effect time is the only kind worth having, because between the approval and the effect
the workflow may have waited a week.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
