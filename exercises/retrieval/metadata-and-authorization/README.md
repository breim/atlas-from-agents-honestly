# Metadata Is Authorization

**Tier:** build. This is a piece of Atlas. Self-contained, like every exercise here; the
narrative continues in the next build rather than the code.

**Chapter:** [Part IV · Retrieval · Metadata Is Authorization](https://agentshonestly.com/book/retrieval/metadata-and-authorization)

The same line of code that narrows a search is the only thing standing between two customers.

## The task

Implement `retrieve(query, principal, index, config)`, returning
`{ results, exposed, revoked, audit, errors }`.

Without a principal there is no retrieval: return nothing and say why.

A chunk is reachable when it is current, carries a tenant tag, that tag matches the
**principal's** tenant, and its ACL intersects the **principal's** live groups. Order by
distance, ties on id.

`enforcement` decides where the filter runs. `in-query` filters before anything is read;
`post` takes the nearest `probe` chunks first and discards afterwards, recording every
unauthorized document it touched in `exposed`. With `lateBinding`, verify each survivor against
`index.liveAcls` and record what the live source no longer grants in `revoked`.

Every request produces an audit naming the principal and the document ids returned.

## The property

`the-hr-document-is-never-a-candidate` is the incident in its canonical form. The compensation
document sits one unit from the query, nearer than either policy the support agent may
actually read, and it never enters the result set. Nothing failed here in the version where it
*does* leak either: no exception, no 403, an accurate answer in the assistant's own voice. The
leak is laundered by generation, which is why the assertion has to be that the document id never
appeared, not that the answer looked wrong.

`post-filtering-reads-restricted-content-out-of-storage` is the same request with the filter
moved four lines later, and it fails twice over. It returns **one** result where in-query
enforcement returns two, and `exposed` names three documents (`HR-900`, `POL-500`, `POL-777`)
that were read out of storage, travelled through the process, and were available to anything
running in between. If you rerank before filtering, those went to the reranker. If you log
candidates before filtering, they are in your logs.
`in-query-enforcement-exposes-nothing-post-filtering-exposes-what-it-read` states the
distinction as an invariant across every case and principal.

`the-model-cannot-influence-the-filter` passes `tenantId: "northwind"` in the query, exactly
what a model that has read a document mentioning another account will do, and the results are
byte-identical to the honest request. The property version sweeps every tenant against every
principal: the model chooses what to search for, your code decides what it is allowed to search,
and there is no argument that bridges the two.

`membership-comes-from-the-request-not-the-index` and
`a-principal-removed-from-every-group-retrieves-nothing` are the two halves of reading
membership live. Bake group membership into the index and someone removed last Tuesday keeps
retrieving restricted content until the next rebuild. That is a revocation that silently
did not happen, found during an audit rather than by an alert.

`the-index-still-grants-what-the-source-has-revoked` and
`late-binding-drops-a-permission-revoked-since-ingestion` are the same request either side of
one config flag. `POL-990` is still tagged `finance` in the index and is no longer granted to
anyone at the source. Without late binding it comes back; with it, it is dropped and named. That
gap is a risk decision, not a technical one.

`the-audit-names-the-principal-and-exactly-what-it-received` is the artifact a regulator asks
for. Generated prose cannot be audited after the fact; the list of retrieved ids is the only
record that a leak happened.

`a-chunk-with-no-tenant-tag-is-invisible-not-public` is deny by default. An ingestion job that
forgets the tag must produce an unreachable document, never a universally readable one. Worth
being precise about what the suite proves here: it kills every *wildcard* reading of a missing
tag (untagged means public, falsy tag skips the check, empty ACL means public), which is the
mistake that actually gets made. Deleting the explicit `tenantId !== null` guard on its own
changes no behaviour, because matching against the principal's tenant already excludes `null`.
The guard stays because it states the rule the schema is supposed to enforce, not because it is
load-bearing.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
