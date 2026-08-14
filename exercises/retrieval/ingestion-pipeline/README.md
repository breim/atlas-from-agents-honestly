# Building the Ingestion Pipeline

**Tier:** build — this is a piece of Atlas. Self-contained, like every exercise here; the
narrative continues in the next build rather than the code.

**Chapter:** [Part IV · Retrieval · Building the Ingestion Pipeline](https://agentshonestly.com/book/retrieval/ingestion-pipeline)

The discourse is about parsers. The incidents are about lifecycle, and this builds the
lifecycle.

## The task

Implement `ingest(sources, index, config)`, returning `{ chunks, manifest }`.

Walk the sources in order. A document that failed to parse is named in the manifest and keeps
whatever it already had indexed. A document missing any of `requiredMetadata` is rejected the
same way — never indexed untagged. A document whose content hash **and** pipeline version both
match what is already indexed is skipped. Everything else is reindexed: its old chunks are
replaced by `chunkCount` new ones, keyed `documentId#position`.

Then reconcile: anything the index knows about that the source no longer lists is tombstoned.

The manifest records what was attempted, parsed, failed, rejected, skipped, reindexed and
tombstoned, how many chunks this run wrote, and the source count against the index count.

## The property

`running-the-pipeline-again-over-its-own-output-changes-nothing` is idempotency stated as a
fixed point, and it runs over **every** case: feed the first run's index back in and the corpus
is byte-identical, zero chunks are produced, nothing is reindexed, nothing is tombstoned twice.
Without deterministic chunk identity a retry after a partial failure doubles part of your
corpus, and duplicate near-identical chunks are precisely the distractors you least want.
`chunk-identity-is-the-document-and-its-position-nothing-else` pins the mechanism, and
`a-re-run-after-a-partial-failure-replaces-chunks-instead-of-doubling-them` checks that the
previous version of a changed document does not survive alongside the new one.

`a-document-deleted-upstream-stops-being-searchable` is the stage most pipelines simply do not
have. Ingestion iterates over what exists and adds it; nothing iterates over what no longer
exists, so a withdrawn policy stays retrievable forever and the agent cites it. The version
filter from two chapters ago defends against the supersessions you know about; it does nothing
about a document that was deleted upstream and that your index still believes is current.
`everything-the-source-no-longer-has-is-tombstoned-and-nothing-else-is` is the diff in both
directions, and `reconciliation-removes-exactly-what-the-source-no-longer-has` is its sharp
edge, worth seeing plainly: an empty source list empties the index. That is what reconciliation
means, and it is why the source listing is the thing you must be sure of before you run it.

`a-timestamp-that-moved-without-the-content-changes-nothing` is change detection done right.
Every document is stamped in the future and nothing is reparsed, because source systems touch
timestamps for reasons unrelated to content. `only-the-content-hash-decides-whether-work-happens`
runs the converse too: change the hashes and everything reindexes.

`a-document-with-no-tenant-is-rejected-not-indexed-untagged` is where the previous chapter's
deny-by-default rule is actually won. An untagged chunk is only invisible at query time if it
exists; the better answer is that it never gets written.
`nothing-is-ever-indexed-without-the-metadata-the-filters-need` asserts it from the other end —
every chunk in the corpus carries what the `WHERE` clause will need, because after ingestion it
is too late.

`a-parse-failure-is-named-in-the-manifest-not-silently-skipped` answers the two questions that
decide whether a corpus is trustworthy: do you know which ones failed, and does anyone see the
number. `a-parse-failure-never-deletes-what-was-already-indexed` keeps a bad parse from
cascading into a deletion.

`a-pipeline-version-bump-reindexes-everything` is why `pipeline_ver` is on every row. Identical
content, new pipeline, and nothing is skipped — which makes a partial migration diagnosable
instead of mysterious.

`the-manifest-accounts-for-every-document-and-reconciles-against-the-index` is the cheapest
observability in Part IV: every source lands in exactly one bucket, and the indexed count is
the corpus. A corpus that is missing documents still shows excellent recall over the ones it
has.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
