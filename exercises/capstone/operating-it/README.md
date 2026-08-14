# Operating It

**Tier:** build — this is a piece of Atlas. Self-contained, like every exercise here; the
narrative continues in the next build rather than the code.

**Chapter:** [Part XX · Capstone · Operating It](https://github.com/breim/agents-honestly/blob/main/content/docs/capstone/operating-it.mdx)

The last review: what it takes to run this thing, and to report on it honestly.

## The task

Implement `operate(rollout, signals, incident, drift, ledger, policy)`, returning
`{ status, errors, warnings, reversibleInSeconds, driftMinutes, ledgerHonest }`.

Refuse a rollout that changes more than `maxChangedFields`, one that discarded the previous index
build, a canary shorter than `minCanaryDays`, and a canary reviewed on dashboards. Require every
incident step **and** the human-consequence injection. Require all four drift queries, reporting
a diagnosis time only when they are all instrumented. Check that the ledger's misses add up.

Warn — without refusing — when a signal moved because its definition was wrong.

## The property

`a-rollout-is-reversible-only-when-it-is-small-and-the-old-build-survives` is the full
two-by-two, and both halves matter. A rollout is one number in a manifest so it can be reversed
in seconds; and retaining the previous index build is what turns an eleven-minute rebuild into an
option you already have. That second decision was made months earlier, which is the point —
`discarding-the-previous-index-removes-the-fast-fix` is the rollout you cannot undo no matter how
small it was.

`the-canary-must-be-long-enough-and-read-by-a-person` is the one that resists automation. Week
one is for **reading outputs**, not watching dashboards, because every product finding came from
somebody opening forty escalations and reading them — and a dashboard-only canary is refused here
even when every number is green.

`a-moved-definition-warns-and-a-moved-implementation-does-not` encodes the diagnostic instinct
worth having: the metric that surprises you first is usually the one whose *definition* was
wrong. It warns rather than failing, because a wrong definition is a thing to go and look at, not
a reason to block a release.

`every-incident-step-is-required-on-its-own` walks all six of the unremarkable ones — breaker
opens, retries stop, fallback serves, tier-one auto-gates, canary confirms it is not you, probe
closes it. `the-human-consequence-is-a-step-of-its-own` is the seventh and the one that gets
skipped: nobody had checked what the approval queue does when gating suddenly triples, because
the drill injected the fault and stopped there.

`drift-is-diagnosable-only-when-all-four-queries-are-instrumented` drops each query in turn and
requires the diagnosis time to become **null** rather than optimistic. Nine minutes is what four
already-instrumented queries cost; three of them cost you an afternoon.

`the-ledger-adds-up-in-both-directions-or-it-is-not-honest` checks under-reporting,
over-reporting, and miscategorisation. Reporting the ledger honestly means every miss appears
*and* is separated by cause, because
`a-known-cause-miss-and-a-structural-miss-are-counted-separately` are two different pieces of
news: one is a bug you understand and one is a limit of the design.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
