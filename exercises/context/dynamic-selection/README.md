# Dynamic Context Selection

**Tier:** build — this is a piece of Atlas. Self-contained, like every exercise here; the
narrative continues in the next build rather than the code.

**Chapter:** [Part III · Context Engineering · Dynamic Context Selection](https://github.com/breim/agents-honestly/blob/main/content/docs/context/dynamic-selection.mdx)

Choosing what the model sees per request, and paying the cache bill that choice creates.

## The task

Implement `select(run, profiles, catalogue, config)`, returning the per-step report plus what
was offered and what was actually used.

Pick a profile from the triage category — once, at the start of the run, unless
`selectPerRequest` says otherwise. The prefix is the system prompt plus the schemas of the
profile's tools plus its instructions. A step is a cache hit when its prefix is identical to
the step before it, and a hit is billed at `cacheReadBps` basis points of the prefix. Tools
surfaced mid-run land after the breakpoint: they cost their schema in that step's variable
tokens and never touch the prefix.

A call to a tool the run has not loaded is refused and never executed. An unknown category
falls back to `default`.

## The property

`a-tool-that-is-not-loaded-cannot-be-called` is the sentence that makes selection more than an
efficiency mechanism. The `policy_question` profile has no `issue_credit`, so a model that asks
for it gets a refusal rather than a credit — the profile is a blast-radius control. Compare it
with `shipping-every-tool-loads-the-one-that-moves-money`, where the identical call succeeds
against a profile that ships the union of everything. Same model, same request, different blast
radius, decided entirely by a lookup table.
`an-unknown-category-falls-back-without-loading-a-write-tool` makes the fallback safe by
construction, and the property version pins it to `default` so that "unrecognised" can never
quietly mean "load everything".

`selecting-per-request-turns-every-step-into-a-cache-miss` is the tension nobody warns you
about. Tools render at position zero, so reselecting the profile every step rewrites the prefix
and nothing behind it caches: the same three-step run costs 8,220 tokens held and 13,150
churned. You saved schemas and started paying full price for the whole history.
`the-prefix-is-identical-at-every-step-unless-the-profile-is-reselected` states the fix, and
`reselecting-per-request-never-bills-less-than-holding-the-profile` proves the direction of the
trade over every case at once.

`an-addition-at-the-end-does-not-cost-the-cache` is the second way out. Surfacing
`search_policies` at step two makes it callable at step three, costs its schema once, and
leaves every prefix untouched — an addition at the end is cheap, a substitution at the front is
not. `a-substitution-at-the-front-costs-everything-behind-it` is the same run with the swap,
and the miss arrives exactly at the step where position zero changed.

`the-bill-is-computed-from-the-prefix-not-assumed` is the chapter's instruction to compute the
trade rather than assume it. Every step's price is rederived from its own prefix, its own
cached flag, and the basis-point rate.

`offered-and-used-partition-into-exactly-what-was-dead-weight` is the operational half. A tool
offered and never called is paid for on every step of every run, and a call that had to be
refused means the categories or the classifier are wrong. Both are logged, and both are
fixable.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
