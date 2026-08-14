# Rollout and In-Flight Migration

**Tier:** drill — a self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part XVIII · Production · Rollout and In-Flight Migration](https://agentshonestly.com/book/production/rollout)

You deploy at 14:00. Three thousand runs are in flight, and eleven have been paused since Tuesday.

## The task

Implement `assign(request, rollout, change)`, returning `{ bundleId, reason, policyVersion }`.

A fresh run is assigned stickily: a holdout tenant always gets stable, otherwise the bucket
decides against the canary fraction. A resuming run does not re-roll — it keeps the bundle it
started with unless the change was a bug fix or a policy change, both of which migrate.

The policy version is always the rollout's current one.

## The property

`a-run-paused-since-tuesday-acts-under-todays-rules` is the split that makes the whole design
work, and `the-policy-version-is-never-the-pinned-one` proves it holds everywhere. The
request carries `pol-1` — Tuesday's rules, pinned when the run started — and the function
never reads it. Prompt, model, and sampling pin at run start so the run stays interpretable;
policy, authorization, and limits resolve at the moment of the action, because if a tier
threshold was lowered on Wednesday because a credit limit was too generous, a run resuming
Thursday must not issue Tuesday's credit under Tuesday's rules.

`a-quality-change-resumes-on-the-bundle-it-started-with` is why runs are not re-assigned.
A run whose first twelve steps were decided under one prompt and whose last eight are decided
under another is on neither version — it is a splice, its outcome is attributable to nothing,
and it pollutes whatever comparison the rollout was for. `a-resuming-run-never-re-rolls-the-bucket`
holds that even when the bucket would say otherwise.

`a-bug-fix-migrates-the-run` is the exception the other way. Consistency is the default
because the run is half-decided; a run that is *currently producing the bug* has nothing
worth being consistent with.

`a-holdout-tenant-is-never-canaried` is the guarantee an enterprise customer was promised,
and the case is built so the bucket says otherwise. Assignment is sticky by **tenant** rather
than per run, so a customer never gets version A on their first ticket and version B on their
second — and a tenant can be analysed as a unit, which matters because tenant is one of the
largest sources of variance in the outcome.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
