# Tool Discovery at Scale

**Tier:** drill. A self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part VIII · Tool Engineering · Tool Discovery at Scale](https://agentshonestly.com/book/tools/tool-discovery)

Nobody writes two hundred tools. They connect five servers.

## The task

Implement `assemble(catalogue, query, limit)`.

Resident tools sit at position zero and are always loaded. Deferred tools are declared but
absent until a search surfaces them: score each by how many distinct query words its
keywords cover, rank by score and then by catalogue order, and append at most `limit` of
them. A tool that matches nothing is never loaded.

Return `{ ok: true, resident, appended, prefixTokens, totalTokens }`, or
`{ ok: false, error }` when the catalogue cannot be assembled.

## The property

`the-resident-prefix-is-identical-for-every-query` is the test that matters, and it is the
whole reason this mechanism works where swapping tool profiles does not. Tools render at
position zero, so a set that varies per request invalidates the cached prefix behind it.
You save three thousand tokens of schema and start paying full price for the other forty
thousand. Discovered schemas are **appended**, not substituted. The prefix never moves, so
it stays valid, and the loaded tool arrives in the same position a new message would.

`a-catalogue-that-defers-everything-is-rejected` and
`a-search-tool-with-nothing-visible-is-rejected` are the two halves of a constraint that
reads like an implementation quirk and isn't. An agent whose every capability is invisible
has nothing to reason from: it cannot know that searching is worthwhile, because nothing in
its context suggests there is anything to find. The search tool stays resident, and so does
at least one real action, which for Atlas is `escalate_to_human`.

`a-generous-limit-is-not-padded-with-non-matches` says spare room is not a reason to spend
it, and `a-namespace-prefix-alone-finds-the-server` is why namespacing stops being a
nicety at this scale. A search over `crm_`, `wms_`, and `erp_` has something to match on. A
search over `listItems`, `getData`, and `fetchRecords` does not, and the mechanism will work
exactly as well as the index it was given.

Note what the function is **not** given: any signal about whether a deferred tool would have
been useful. Undiscovered is indistinguishable from unavailable, and the model answers from
what it found.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
