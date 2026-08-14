# MapReduce Tree

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Scale Patterns · MapReduce Tree](https://agentshonestly.com/book/patterns/scale/mapreduce-tree)

Combine a hundred summaries without ever putting a hundred summaries in one prompt.

## The task

Implement `reduceTree(items, fanIn)`, returning `{ result, levels }`.

Merge adjacent items in groups of at most `fanIn`, repeating until one remains. A group
of several merges to `(a+b+c)`; a group of one carries through untouched. `levels`
records each round.

The property is the one the pattern exists for: **no merge step ever sees more than
`fanIn` inputs**. A single-pass reduce over a hundred documents means a hundred summaries
in one context — which either does not fit or costs a fortune and buries the middle. The
tree bounds every individual call at `fanIn` regardless of how many items arrive.

`an-odd-item-carries-to-the-next-level` is the case that catches the common bug. With
three items and a fan-in of two, `c` has no partner. Merging it into the previous group
gives a step with three inputs, which quietly violates the bound the whole design rests
on. It carries instead, and merges one level up.

Merging adjacent items keeps the reduce order-preserving, so `(((a+b)+(c+d))+e)` reads
left to right. That matters when the items are chapters, transcript segments, or
anything else where sequence is meaning.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
