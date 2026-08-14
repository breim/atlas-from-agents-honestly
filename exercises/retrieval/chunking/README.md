# Chunking

**Tier:** build — this is a piece of Atlas. Self-contained, like every exercise here; the
narrative continues in the next build rather than the code.

**Chapter:** [Part IV · Retrieval · Chunking](https://agentshonestly.com/book/retrieval/chunking)

The parameter nobody revisits, and the ceiling it sets for everything downstream.

## The task

Implement `chunk(document, config)`, returning `{ parents, children }`.

A document is a list of blocks with a kind and a token count. Headings define the sections, so
each heading closes the current parent and opens a new one, carrying a heading trail built from
the level stack. Parents hold everything in their section, headings included.

Then pack each section's content blocks into children, greedily, up to `maxChildTokens` — with
one rule that outranks the cap: a block whose kind is in `neverStartsAChunk` may never *begin*
a chunk. When the cap and that rule disagree under the `structural` strategy, the rule wins and
the chunk runs long. Under `fixed`, the cap always wins.

Every parent and every child carries `documentId` and `version`.

## The property

`the-child-that-matches-does-not-answer-but-its-parent-does` is the chapter's title argued as a
test, and it is the whole reason this exercise exists.

The corpus says *"Opened electrical components may be returned within 30 days"* followed by
*"Except where the component has been energized or the anti-static packaging has been broken."*
Under `fixed`, those land in different chunks. Now watch what the metrics do: the query *"can we
return opened relays?"* matches the first chunk, which is **unambiguously the right chunk** —
it ranks first, it counts as a hit, recall looks excellent. And the answer is "yes, within 30
days," which is false for this customer. The retrieval eval passes and the generation is wrong,
so the investigation goes to the prompt, then to a bigger model, and three weeks later somebody
reads the chunk.

The test asserts both halves: the matched child is *missing* a block it needed, and the parent
it belongs to contains all of them. That is parent/child earning its place — search on the sharp
small unit, hand the model the unit that can actually answer.
`structural-splitting-leaves-every-child-answerable-on-its-own` is the same question against the
splitter that knows better, and there the child alone suffices.

`no-child-ever-begins-with-a-block-that-cannot-stand-first` is the rule stated directly, and
`a-chunk-goes-over-its-cap-rather-than-make-a-cut-it-must-not-make` is the trade it implies: the
electrical-components child is 115 tokens against a cap of 100, deliberately, because the
alternative is severing a rule from its exception. A chunk that runs long is a cost; a chunk
that lies is a bug.

`a-table-is-one-chunk-however-large` keeps a 300-token table atomic against a 100-token cap,
because a row without its header is noise and a header without its rows is worse.

`every-chunk-carries-the-document-and-version-it-must-be-cited-by` is where the acceptance
spec's citation requirement is won or lost. Atlas must cite document and version; chunking is
the stage that makes that possible or impossible, and there is no recovering it later.
`the-heading-trail-is-the-ancestry-deepest-heading-last` is the other half of self-description —
a chunk reading *"...must be approved by the regional manager"* is unusable until it knows it
sits under `Returns Policy › Approval Matrix`.

`no-chunk-stops-early` keeps the packing honest, and
`the-strategy-changes-how-children-are-packed-and-never-what-parents-are` isolates the variable:
both strategies see the same sections, so every difference in the results is a difference in
where the cuts fell.

`a-document-with-no-headings-still-produces-one-parent` is the honest answer for transcripts and
scanned PDFs. The structural techniques have nothing to work with, and pretending otherwise
produces confident nonsense.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
