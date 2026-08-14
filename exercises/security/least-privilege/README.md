# Least Privilege

**Tier:** build. This is a piece of Atlas. Self-contained, like every exercise here; the
narrative continues in the next build rather than the code.

**Chapter:** [Part XVI · Security · Least Privilege](https://agentshonestly.com/book/security/least-privilege)

Six scoping axes, and the two that stop the attacks the obvious one misses.

## The task

Implement `govern(grants, run, policy)`, returning
`{ status, findings, decisions, blocked, escalated, spentCents }`.

Audit the grants: an unused one, a missing required scope, a per-call cap with no per-run cap, a
tool that appeared after the audit, unattended execution on a run that did not need it, and a
standing credential are all findings.

Then judge each call in order: refuse an ungranted or newly appeared tool, an entity not already
in scope for the run, an amount over the per-call cap, and an amount that would take the run past
its aggregate cap. A refusal escalates and does not stop the calls behind it. In `shadow` mode
nothing is blocked, but everything is still escalated.

## The property

`twenty-small-credits-are-stopped-by-the-aggregate-cap` is the attack per-call caps cannot see.
The test first asserts that **every** call sits comfortably under the per-call limit, then that
the run is stopped anyway, because the axis that matters here is the aggregate, and
`a-per-call-cap-without-a-per-run-cap-misses-the-slow-attack` flags the configuration that would
have let it through. `spend-never-exceeds-the-aggregate-cap-however-the-calls-are-split` throws
forty calls at four different sizes and the ceiling holds.

`a-call-is-allowed-only-when-its-entity-is-already-in-scope-for-the-run` is the binding that
makes an injected argument inert. The entity comes from your own records, so a model persuaded to
credit `order:9999` is refused by arithmetic rather than by judgement.

`every-unused-grant-is-a-finding-one-at-a-time` is the shift the chapter opens with. An unused
permission used to be latent; an agent choosing at runtime from attacker-influenced text makes
every unused grant reachable, and deleting the tool removes the permission *and* the context it
cost every turn.

`unattended-is-a-finding-only-when-the-run-is-not-attended` runs the full truth table, because
autonomy is the excess people forget: unattended execution is a permission even though it does
not look like one.

`a-newly-appeared-tool-is-denied-even-when-everything-else-is-fine` is what a dynamic catalogue
does to a point-in-time audit. The answer is to deny by default rather than to re-audit
continuously.

`shadow-mode-changes-what-is-blocked-and-nothing-else` and
`a-denial-escalates-whether-or-not-it-blocks` are the rollout discipline. Shadow mode is how you
measure a policy for a week before it can hurt anyone, and it must not quietly stop *reporting*.
The escalation count is identical in both modes, which is the whole point of running it.
Denials escalate rather than erroring, because a control operators disable is worth less than one
that is slightly too tight.

`a-refused-call-never-spends-and-never-stops-the-ones-behind-it` keeps one bad argument from
taking down a legitimate run.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
