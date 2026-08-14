# Checkpoints, Persistence, Resumability

**Tier:** build — this is a piece of Atlas. Self-contained, like every exercise here; the
narrative continues in the next build rather than the code.

**Chapter:** [Part VII · LangGraph · Checkpoints, Persistence, Resumability](https://agentshonestly.com/book/langgraph/persistence)

The chapter that justifies the graph, and the exact point where it runs out.

## The task

Implement `execute(graph, thread, store, config)`, returning
`{ status, path, checkpoints, applied, duplicated, store }`.

Run each node's effects in order. A checkpoint is written **after a node completes** — never
inside one. So when a scripted crash fires mid-node, the resume re-enters that node **from its
first effect**, and everything in it runs again.

Each non-read-only effect takes an idempotency key. A deterministic one is
`thread:node:effect:discriminator`; a `random` one appends a fresh nonce every time it is
computed. If the key is already in the store, the effect is deduplicated; otherwise it lands.
Read-only effects take no key and always run.

An `approval` effect pauses the run the first time it is reached and is memoised thereafter —
but the resume still restarts the node from the top. Report in `duplicated` any effect that
*landed* more than once.

Refuse to run at all when `requireLease` is set and the thread does not hold it. Stop instead of
resuming when `autoResume` is off.

## The property

`a-crash-mid-node-re-runs-every-effect-in-it` is the mechanic everything else follows from. The
node fetched an order, posted a refund, and died. On resume it does not continue at the email —
it starts again at the fetch. Nothing inside a node is memoised, because the framework records
state *between* nodes and has no record that any call occurred.

`a-random-key-generated-inside-the-node-defeats-the-mechanism` is the same crash, in the same
node, with one thing changed. `a-deterministic-key-survives-replay-and-a-random-one-does-not`
puts them side by side and asserts the paths are identical, so the keys really are the only
difference: one payments provider sees one refund, the other sees two. That is the whole
mitigation, and note where the burden sits — on you, and on the remote system honouring it.

`an-interrupt-re-executes-everything-else-in-the-node` is the most common production surprise
in graph-based approvals, and it is not a crash at all. The node notified the warehouse, paused
for approval, and resumed — re-running the notification, because the approval is memoised and
its siblings are not. `one-call-per-node-means-a-resume-cannot-double-fire-anything-else` is
the same approval moved into a node of its own: same number of approvals asked for, and nothing
duplicated, because there is nothing else in the node to re-fire. An unglamorous rule that
deletes a category of incident.

`a-checkpoint-is-written-between-nodes-not-inside-them` shows the boundary doing its job:
`triage` and `gather` completed, so they are never re-entered; only `credit` runs twice.
`a-read-only-effect-re-runs-freely-and-never-counts-as-a-duplicate` is the case where all this
is harmless — a few cents of lookups returning the same answers.

`a-crashed-run-nobody-resumes-is-durable-and-permanently-stopped` is the sentence people miss
when they upgrade to a durable store. The checkpoint survived the process; nothing noticed the
process was gone. The run is durable and stopped, and
`a-stopped-run-leaves-its-work-half-done-and-says-so` compares it against the resumed version:
fewer checkpoints, fewer effects, and no error anywhere. Without a sweeper, that is
indistinguishable from a run that finished.

`a-worker-without-the-lease-does-not-resume-the-thread` is the coordination the checkpointer
does not do for you, and
`two-workers-sharing-a-store-cannot-land-the-same-keyed-effect-twice` shows what saves you when
the lease is missing: the keys, again.

## A note on `maxNodeEntries`

The engine carries a hard bound on node entries that no correct run comes close to. It exists
because an implementation that forgets to memoise an interrupted approval loops forever rather
than failing — and a test suite that hangs is worse than one that fails.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
