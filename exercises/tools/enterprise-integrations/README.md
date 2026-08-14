# Enterprise Integrations

**Tier:** drill — a self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part VIII · Tool Engineering · Enterprise Integrations](https://agentshonestly.com/book/tools/enterprise-integrations)

Reconciliation compares state, not processing logs.

## The task

Implement `reconcile(snapshot, projection)`, returning
`{ missing, stale, ahead, extra, inSync }`.

The snapshot is what the source system currently says is true. The projection is the local
copy. A record in the snapshot the projection never received is **missing**; one the
projection holds at an older version is **stale**; one it holds at a newer version is
**ahead**; one the projection has and the source no longer does is **extra**. `missing`,
`stale`, and `ahead` follow snapshot order; `extra` follows projection order.

## The property

Look at what the function is not given. There is no event log, no applied count, no error
tally — and that omission is the chapter.

`a-clean-event-log-still-leaves-a-record-missing` is the case. Every event the consumer
received parsed, applied, and committed. The dashboard is green. `acct-3` is not in the
projection, because the event announcing it never arrived, and an event that never arrived
leaves nothing behind to count. A consumer with zero errors is evidence about the events
you got, and silence about the ones you didn't. Only comparing state can tell you.

`a-partial-snapshot-never-derives-a-deletion` is the second opinion, and it is the one that
protects the replica. A provider can return three pages and fail on the fourth. Every id on
the pages that did arrive is proven to exist; nothing at all is proven about the ids that
didn't. Treating that listing as the full truth turns a transport failure into a mass
deletion — the reconciliation job destroying the replica it was written to repair.

So `complete: false` suppresses `extra` entirely while leaving `missing` and `stale` intact
(`a-partial-snapshot-still-reports-what-it-did-see`), and it makes `inSync` false even when
nothing differs (`a-matching-partial-snapshot-is-still-not-in-sync`). Agreeing with half the
truth is not the same as being correct, and a replica that cannot prove it is complete has
to say so.

`a-newer-version-in-the-projection-is-not-stale` separates two diagnoses that look alike in
a count of mismatches. A projection ahead of the snapshot is usually snapshot skew — the
listing was taken before the last write landed. Repairing it by writing the source's version
over the newer local one is a regression, not a fix.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
