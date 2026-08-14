# SQL Is Still the Answer

**Tier:** build — this is a piece of Atlas. Self-contained, like every exercise here; the
narrative continues in the next build rather than the code.

**Chapter:** [Part IV · Retrieval · SQL Is Still the Answer](https://agentshonestly.com/book/retrieval/sql-is-still-the-answer)

Shape two of three: the governed query builder, and the failure mode you actually want.

## The task

Implement `compile(request, layer, rails, principal)` — `compile_query` in Python, because
`compile` is a builtin — returning `{ status, sql, params, refusals, applied }`.

The model emits a query object naming a metric, some dimensions, and a period. Your code
compiles it. Anything the layer has not defined is refused, and **every** reason is reported,
not just the first. Raw SQL from the model is refused outright, as is any attempt to set a
reserved filter.

When it compiles, the metric definition supplies the table, its own filters, and its time
column; the compiler supplies `tenant_id = $1` from the principal and the row limit from the
rails. Parameters are always `[tenantId, from, to]`.

## The property

`an-unknown-metric-is-a-refusal-not-a-guess` is the asymmetry the whole chapter turns on. Ask
for `profit`, which nobody defined, and the answer is "I cannot answer that" — not a plausible
`SELECT` over a column that looked close. A refusal routes to a human and costs a few minutes;
a confident wrong number goes in a quarterly report. Those are not two points on a quality
scale. `anything-the-layer-does-not-define-is-refused-rather-than-guessed-at` sweeps the same
assertion over an undefined metric, dimension, and period, and
`a-refusal-never-carries-a-query-and-a-compiled-query-never-carries-a-refusal` keeps the two
states from blurring.

`a-governed-query-names-the-time-column-the-model-never-picked` is where the accuracy actually
lives. Revenue is measured on `shipped_at` and orders on `created_at`, and nothing in a schema
says so — that fact lives in one analyst's head until somebody writes it down. Roughly four in
five text-to-SQL errors are exactly this shape: perfectly valid SQL answering a different
question, returning rows, raising nothing.
`the-time-column-comes-from-the-metric-definition-never-from-the-request` proves it for every
metric at once, and additionally asserts that no *other* metric's time column can leak in.
`the-metric-carries-its-own-filters-into-every-query-that-uses-it` is the second half — revenue
excludes cancelled and draft orders whether or not the asker knew that.

`the-same-question-compiles-the-same-way-for-every-asker` is metric drift made impossible by
construction. Two principals, one query shape, one definition of revenue; only the tenant
parameter differs. Without a layer, the same question asked twice returns two numbers that are
each defensible and not equal, and the organisation loses the ability to agree on a figure.

`tenancy-is-decided-by-the-compiler-not-the-model` and
`every-compiled-query-pins-the-tenant-to-the-principal-in-the-first-parameter` are the same rule
as the previous chapter, enforced in a different component. The model asking for
`tenant_id: "northwind"` is refused by name, and every compiled query pins the predicate first
in the `WHERE` regardless.

`raw-sql-from-the-model-is-never-executed` is the boundary between shape two and shape three.
The request carries a syntactically fine query and it is refused, because the point of the
architecture is that there is no path from a model's string to the database.

`a-row-limit-is-enforced-server-side-not-requested-politely` clamps 100,000 to the rail, and the
property version walks limits from 1 to five million and checks both the applied value and the
query text. `the-rails-hold-whatever-was-asked-for-refusal-or-not` keeps the timeout and the
read-only flag in place even on the requests that never compile.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
