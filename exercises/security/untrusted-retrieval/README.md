# Untrusted Retrieval

**Tier:** build. This is a piece of Atlas. Self-contained, like every exercise here; the
narrative continues in the next build rather than the code.

**Chapter:** [Part XVI · Security · Untrusted Retrieval](https://agentshonestly.com/book/security/untrusted-retrieval)

Splitting the corpus by who could write the bytes, and routing by what the task may do.

## The task

Implement `retrieve(chunks, task, policy)`, returning
`{ status, errors, chunks, tainted, citations, competingForQuery, poisonRatioBps, drifted, writers }`.

Refuse a chunk whose provenance was inferred from its content, and any chunk whose content hash
no longer matches what was ingested. Refuse a **high-authority** task whose competing set
contains a provenance the policy does not allow. Refuse when citations are required and nothing
competes.

Otherwise serve what competes for the query, taint the run if anything served is not
first-party, report the poison ratio in basis points **against the competing set**, and list
every writer behind what was served.

## The property

`the-poison-ratio-ignores-everything-that-does-not-compete-for-the-query` is the number the
canonical study turns on. Pad the corpus with forty more first-party documents and the ratio does
not move, because the denominator is what competes for *that query*, not corpus size. Five
malicious texts in a corpus of millions reached a 90% success rate precisely because the payload
was written to win the queries it targets, and reranking does not help, since the document is
deliberately, genuinely relevant.

`the-same-corpus-is-safe-for-one-task-and-refused-for-another` is the routing decision as a
single assertion. Nothing about the corpus changed; the authority of the task did.
`a-high-authority-task-refuses-every-provenance-the-policy-does-not-allow` sweeps each
provenance through both authorities and requires the high one to accept only what the policy
lists. That is the trifecta broken where it counts: the workflow that can move money never reads
attacker-writable text.

`provenance-inferred-from-content-is-refused-wherever-it-appears` is the rule that makes the rest
possible. Provenance is a column the loader assigns; the moment it is guessed from the bytes, the
attacker is writing the label too.

`a-source-that-changed-since-ingestion-is-refused` is the time-shifted half of the attack. The
document was fine when you crawled it, and a vendor page that turns hostile afterwards is
otherwise a completely silent change. The property drifts each chunk in turn.

`a-run-is-tainted-exactly-when-something-not-first-party-is-served` wires retrieval provenance to
the run's taint flag, so an external chunk taints exactly as a customer ticket does.

`every-served-chunk-is-cited-and-every-citation-resolves` and
`the-writer-list-is-every-writer-behind-what-was-served` are the incident-response half. Without
citations that resolve to chunk ids, the scope of an incident is "everything since ingestion";
without the writer audit, you are asking who owns the database rather than who could write the
bytes.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
