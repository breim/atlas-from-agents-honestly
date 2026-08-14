# Identity Propagation

**Tier:** micro. One pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Security Patterns · Identity Propagation](https://agentshonestly.com/book/patterns/security/identity-propagation)

The agent acts for a user. It must not act as itself.

## The task

Implement `act(user, need, service)`, returning `{ allowed, principal, reason }`.

A call is permitted only when **both** the user and the service account hold the scope,
which is the intersection. `principal` is always the user, never the service. No identity
at all is `no_identity`, and it fails closed.

The three refusals are three different mistakes:

- `a-scope-only-the-service-holds-is-refused`: the agent's own token has `admin` and the
  user does not. This is the default failure of every agent built on a service account:
  it works, it is convenient, and it means any user who can phrase a request can reach
  anything the agent can reach.
- `a-scope-only-the-user-holds-is-refused`: the user has `billing:write` and the agent
  was never granted it. Least privilege applies to the agent too; it does not inherit a
  capability by carrying someone who has it.
- `the-effective-scope-is-the-intersection`: the user holds `admin` and `billing:write`
  but not `orders:write`, and the service holds `orders:write`. Neither party's list is
  the answer on its own.

`the-acting-principal-is-always-the-user` is what makes the audit log worth keeping. A
trail that records `atlas-agent` did everything answers no question anyone will actually
ask.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
