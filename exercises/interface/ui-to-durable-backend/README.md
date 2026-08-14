# UI to a Durable Backend

**Tier:** build — this is a piece of Atlas. Self-contained, like every exercise here; the
narrative continues in the next build rather than the code.

**Chapter:** [Part XVII · Interface · UI to a Durable Backend](https://github.com/breim/agents-honestly/blob/main/content/docs/interface/ui-to-durable-backend.mdx)

The API layer between a browser and a workflow engine, and the four things it must never do.

## The task

Implement `serve(request, entitlements, policy)`, returning
`{ status, errors, workflowId, source, order }`.

Refuse outright — before anything else — a request that carries a workflow id from the browser,
one that holds the connection open, a `start` on `GET`, credentials in a buffered stream, or a
polled query.

Then authorise: no principal, no business id, or no entitlement all return **404**. Derive the
workflow id from the business identity. `start` and `signal` return `202` immediately; `list`
comes from the read model; `reconnect` opens the stream, snapshots, renders, then reconciles;
`query` reads the workflow once.

## The property

`the-workflow-id-is-always-derived-never-accepted` is the requester rule arriving at the HTTP
layer, having already appeared at the tool boundary and the policy layer. Making the workflow id
the business entity was the right call and it made the id guessable — so accepting one from the
browser is broken object-level authorization, and the test refuses three different supplied ids
including the *correct* one.

`an-entitlement-failure-is-indistinguishable-from-a-missing-record` is the detail that decides
whether the API leaks. An unentitled request and a nonexistent one return byte-identical
responses, because a `403` confirms the record exists. `nothing-is-ever-refused-with-a-403`
states it across every case, and `every-principal-sees-only-what-it-is-entitled-to` sweeps the
full principal-by-entity matrix.

`a-cold-load-opens-the-stream-before-it-takes-a-snapshot` is the ordering that looks arbitrary
and is not. Query first and every event arriving before the stream attaches is lost, silently,
on exactly the loads that matter most. The test asserts the sequence rather than the endpoints.

`a-list-never-touches-the-cluster-and-a-detail-view-always-does` is the split between the read
model and the query. A stale list row is cosmetic; a stale detail view is an approval against a
state that has moved — and the cluster is not a database you can list like rows.

`polling-is-refused-for-a-query-and-irrelevant-elsewhere` is the load-shape argument. Polling
scales with open browser tabs rather than with work, so it peaks during the incident, when
everyone has the dashboard open and the system can least afford it.

`the-four-forbidden-behaviours-are-each-refused-on-their-own` checks each prohibition in
isolation, and `a-refused-request-derives-nothing-and-reaches-nothing` makes the refusals
meaningful: no id derived, no source named, no work done.

`a-start-on-POST-is-fine-and-the-same-start-on-GET-is-not` keeps the method rule scoped to
starting work — a `GET` query is exactly right.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
