# Compensation

**Tier:** build — this is a piece of Atlas. Self-contained, like every exercise here; the
narrative continues in the next build rather than the code.

**Chapter:** [Part XI · Durability in Practice · Compensation](https://agentshonestly.com/book/durability/compensation)

The sequence where every step succeeded and the outcome is still wrong.

## The task

Implement `run(plan, catalogue, world, config)`, returning
`{ status, errors, applied, unwound, incidents }`.

Validate first, and run nothing if anything fails: a tool that is not in the catalogue, a
reversible write with no declared compensation, or anything not reversible sitting **before**
the pivot.

Then apply the plan. A transient failure retries to `maxAttempts`; a business rejection is
attempted once, because retrying it changes nothing. On a failure **before** the pivot, unwind
in reverse over only the steps that actually succeeded — a compensation that fails becomes an
incident naming a human and does not stop the rest. On a failure **after** the pivot, finish
forward.

## The property

`a-failure-before-the-pivot-unwinds-in-reverse` and `a-failure-after-the-pivot-finishes-forward`
are the same plan failing at two different points, and they go opposite directions. That is the
sequencing argument: order the steps by reversibility, name the pivot, and past it the correct
response to failure is to finish rather than to reverse — because you cannot un-send an email, a
human has already read it. `the-pivot-decides-the-direction-wherever-it-sits` moves the pivot
and watches the direction flip with nothing else changed.

`only-steps-that-actually-succeeded-are-unwound-in-reverse` is the mechanic. The event history
is the authoritative record of which effects ran, and it is exactly that set — not the plan —
that has to come back. The step that failed is not unwound, because it never landed.

`a-business-rejection-does-not-burn-the-retry-budget` is a small rule with a large effect. A
declined card is not a transient failure; retrying it three times only delays the unwind while
holds sit on the customer's funds. The property checks all three outcome kinds get the attempt
count they deserve.

`a-compensation-that-fails-raises-an-incident-and-the-rest-still-run` is the part people get
wrong by writing the unwind as a transaction. One compensation failing must not abandon the
others — the remaining holds still need releasing — and the failure has to surface with a name
attached rather than in a log nobody reads.

`a-reversible-write-with-no-compensation-cannot-take-part` is the check that belongs at build
time. In a designed saga the sequence is known; in an agent the model chose it, so compensations
attach to **tools in the catalogue** and a tool without one is a hole you should find in review
rather than during an incident. `anything-not-reversible-before-the-pivot-is-a-design-error`
sweeps every non-reversible tool in the catalogue against that rule.

`an-invalid-plan-runs-nothing-at-all` is what makes those checks worth having: a saga that
cannot be unwound must not begin.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
