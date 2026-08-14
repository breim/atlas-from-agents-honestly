# Tenant Isolation

**Tier:** build. This is a piece of Atlas. Self-contained, like every exercise here; the
narrative continues in the next build rather than the code.

**Chapter:** [Part XVI · Security · Tenant Isolation](https://agentshonestly.com/book/security/tenant-isolation)

Securing the index is the part everyone does. This checks the other six stores.

## The task

Implement `inspect(stores, run, policy)`, returning
`{ status, findings, reads, uninventoried, layers }`.

Audit every store: not in the inventory, not engine-enforced when its kind requires it,
accepting its key from the caller, or shared without the tenant scoped to the transaction. More
than one authorization decision point is a finding on its own.

Then judge each step of the run: refuse an unknown store, a step with no tenant, a step whose
tenant is not the run's, and a resumed step on another machine reading a store whose key it did
not derive. Report the three layers as counts.

## The property

`securing-one-store-secures-nothing-on-its-own` is the chapter's opening argument as a loop: pick
any single store, secure only that one, and the system still leaks. The vector index is the part
everyone does, and the leak comes from the checkpointer, the history, the memory store, the
cache, the trace or the eval set. Every one of them was introduced to solve a durability or
quality problem, by people thinking about neither authorization nor tenancy.
`the-agent-specific-stores-are-held-to-the-same-rule-as-the-index` asserts the policy actually
covers them rather than exempting the ones that arrived later.

`a-shared-store-is-only-safe-when-the-tenant-is-scoped-to-the-transaction` walks the full truth
table and flags exactly one combination. A pooled connection still carrying the previous caller's
tenant is a cross-tenant bug that appears **under load** and vanishes when you go looking for it.

`a-key-accepted-from-the-caller-is-a-finding-wherever-it-happens` is the smallest rule with the
widest reach. A thread id supplied as an argument is an authorization decision delegated to
whoever supplied it; derive it, and there is nothing to delegate.

`more-than-one-decision-point-is-a-finding-and-exactly-one-is-not` checks zero, one, two and
three. Three partial authorization systems have the security of the weakest, and the fix is one
decision point or none, never two that mostly agree.

`a-resumed-step-on-another-machine-must-derive-its-key` is the four-way table where tenancy meets
durability. Tenancy has to survive pauses, resumption elsewhere, retries and fan-out, which is
why it lives in the run's identity and is re-derived rather than carried.

`a-leak-in-the-reads-is-a-leak-even-when-every-store-is-configured-well` is the separation that
keeps the report honest: the findings list is empty, every store is textbook, and the run still
crossed a tenant boundary. Configuration and behaviour are different questions.

`every-store-outside-the-inventory-is-named` is what makes this testable at all. Isolation admits
deterministic tests: cross-tenant negative suites per store, a missing-filter canary,
wrong-tenant resumption. All of them depend on knowing the full list of stores.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
