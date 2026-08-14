# Versioning Prompts, Models, and Graphs

**Tier:** drill — a self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part XVIII · Production · Versioning Prompts, Models, and Graphs](https://github.com/breim/agents-honestly/blob/main/content/docs/production/versioning.mdx)

The git SHA identifies your code. It does not identify what the model was given.

## The task

Implement `execute(run, environments)`, returning the run's `configKey` and one record per
action.

`configKey` is content-addressed: the bundle's fields sorted by name and joined as
`name=value` with `|`. Resolve it **once**, from the environment in force when the run
started, and carry it on every action. Resolve the **policy** separately, from the
environment in force when each action happened.

The environment in force at a time is the latest entry at or before it.

## The property

`a-deploy-mid-run-does-not-change-the-run` and `a-deploy-after-the-run-started-never-reaches-it`
are why the bundle resolves once. A run that changed configuration at step twelve is not one
experiment; it is two, spliced, and neither half is interpretable — not by an eval, not by a
cost comparison, not by the person answering a dispute about a reply sent on the 14th.

`policy-resolves-at-the-moment-of-each-action` is the deliberate exception, and it runs the
other way for a reason. Carry the tier thresholds and the authorization rules in the bundle
and a run that paused three days waiting for an approval acts on Friday's permissions when it
resumes on Monday. Configuration is what the model was given; policy is what you currently
allow, and those are different questions with different correct answers.

`editing-a-tool-description-is-a-new-configuration` is the field teams leave out. A tool
description is prompt text that happens to live in a schema, and it usually ships in a PR
reviewed as a code change. Nothing about `sp1` moved, and the agent behaves differently.
`a-re-index-is-a-configuration-change-with-no-code-in-it` is the same failure with no PR at
all.

`a-later-deploy-of-the-same-bundle-is-the-same-configuration` and
`the-key-does-not-depend-on-the-order-the-fields-were-written-in` are what content addressing
buys over `prompt-v2.1.3`. Two deploys that resolve to the same bundle *are* the same
configuration, whatever the git history says — which is what makes rollback a repoint rather
than a revert, and makes "staging is on this key" a fact rather than an inference.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
