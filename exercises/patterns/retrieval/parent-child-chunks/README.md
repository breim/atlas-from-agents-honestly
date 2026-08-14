# Parent–Child Chunks

**Tier:** micro. One pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Retrieval Patterns · Parent–Child Chunks](https://agentshonestly.com/book/patterns/retrieval/parent-child-chunks)

Match on the small chunk, send the surrounding one.

## The task

Implement `expand(hits, chunks, parents)`, returning the texts to send to the model.

Each hit is a child chunk id. Return its parent's text, deduplicated, in the order
each parent was *first* reached. A chunk with no parent contributes its own text. An
id that matches no chunk is skipped, not an error.

`two-hits-sharing-a-parent-return-it-once` is the reason this exists as a function
rather than a `map`. Small chunks retrieve well precisely because they are narrow, so
a good query routinely hits three sentences of the same clause, and sending that
clause three times spends the window on duplicated text and teaches the model that the
repeated passage is the important one.

Ordering by first hit, rather than by parent id, keeps the retriever's ranking visible
to the model.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
