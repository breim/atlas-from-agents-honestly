# Context as an Allocation Problem

**Tier:** build — this is a piece of Atlas. Self-contained, like every exercise here; the
narrative continues in the next build rather than the code.

**Chapter:** [Part III · Context Engineering · Context as an Allocation Problem](https://agentshonestly.com/book/context/context-as-budget)

Replacing "whoever appends last wins" with a table that sums and a policy for every row.

## The task

Implement `allocate(request, budget)`, returning
`{ status, breakdown, total, headroom, evicted, errors }`.

The budget names every claimant, its allocation, and the policy for exceeding it. The request
carries what each claimant actually wants, in tokens.

Check the constants first: the system prompt and the tool schemas are fixed at write time, so
going over is a **build failure**, and a failed build trims nothing. Otherwise bound each
unbounded claimant to its row, evicting in the order the budget declares — oldest tool
results, then oldest turns, then the lowest-ranked documents, then the user's message, which
is truncated rather than dropped.

Headroom is whatever the window has left after the output reserve and the total. It is a
number you report, never a number you spend.

## The property

`a-larger-window-changes-only-the-headroom` is the chapter's strongest claim as an assertion,
and the property version runs it over every case at once: multiply the window by ten and the
breakdown, the evictions, and the total are all identical — only the headroom moves. A larger
window is permission to send more, not a reason to. This is the test that fails the moment
someone "just adds room" because the window can take it, and it is the difference between a
budget and a high-water mark.

`the-output-reserve-is-never-lent-out` is the hard reserve, checked as an identity:
`total + reserve + headroom == window`, always. The case that proves it has every single row
inside its allocation and still does not fit a 40,000-token window — the budget table itself is
too large for that model, which is a planning problem and not something eviction can fix. It
reports `over` rather than quietly borrowing the 8,000 tokens the answer needs.

`a-system-prompt-over-budget-fails-the-build-and-evicts-nothing` is the rule that constants
are a code-review problem. Both build-failure cases are deliberately *also* over on a runtime
claimant, so the assertion has teeth: nothing is trimmed, because enforcing a constant at
runtime is an admission that nobody owns it.

`facts-are-evicted-before-turns-and-turns-before-documents` is the eviction order decided in
advance, all four claimants overflowing at once. The order encodes the claim that old facts
are cheaper to lose than old instructions: a result from step two already did its work and the
conclusion is in the transcript, while the system prompt has to do its work again on every
step. `the-system-prompt-and-the-tool-schemas-are-never-evicted` states the other end of the
same list.

`within-a-claimant-the-oldest-and-the-lowest-ranked-go-first` checks the tie-break, and
`too-many-documents-are-reranked-down-not-given-more-room` is why it matters for retrieval:
raising `k` adds precisely the chunks most likely to be confused with the right one, because
similarity is what ranked them. Five well-reranked chunks beat twenty raw ones on accuracy, not
only on cost.

`an-unbounded-claimant-cannot-grow-the-request-past-its-row` is the forty-thousand-row query.
A tool result of 400,000 tokens is bounded where it enters, not where it explodes.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
