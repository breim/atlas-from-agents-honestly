# Dual Control

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Security Patterns · Dual Control](https://agentshonestly.com/book/patterns/security/dual-control)

Some actions should need two people, and two people means two.

## The task

Implement `authorise(request, approvals, required)`, returning
`{ authorised, reason, approvers }`.

An approval counts only when it names the **same action** as the request, comes from
someone other than the requester, and from someone who has not already approved.
`approvers` is the list of distinct valid approvers, in arrival order. `reason` is set
only when the action is *not* authorised, checked in the order `self_approval`,
`duplicate_approver`, `insufficient_approvals`.

Three ways a two-person rule quietly becomes a one-person rule:

- `the-same-person-twice-is-not-two-people` — the same approver submits twice, a naive
  length check sees two, and the control is gone. Count distinct identities, not events.
- `the-requester-cannot-approve-their-own-request` — dual control that lets the
  requester supply one of the two signatures is single control with extra steps.
- `an-approval-for-a-different-action-does-not-count` — Ravi approved a 500-cent credit
  and the request is for 9000. Counting approvals per *request* rather than per *action*
  lets an amount change after the fact and keep its signatures.

That last one is the same binding property as [Approval Gate](../../durability/approval-gate),
and it is the one that survives a determined attacker rather than a careless one.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
