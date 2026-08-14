# Compaction and Summarization

**Tier:** drill — a self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part III · Context Engineering · Compaction and Summarization](https://github.com/breim/agents-honestly/blob/main/content/docs/context/compaction.mdx)

Dropping a turn is not free, because what it knew has to go somewhere.

## The task

Implement `compact(turns, budget, costPerFact)`, returning
`{ kept, summarised, tokens, fits }`.

Turns arrive oldest-first. Drop from the oldest end until the transcript fits. Every fact
carried by a dropped turn moves into a summary, deduplicated, in first-appearance order —
and the summary costs `costPerFact` tokens per distinct fact, **against the same budget**.
`tokens` is kept-turn tokens plus summary cost. `fits` is false when even a fully
compacted transcript is over.

The whole drill is that second term, and
`dropping-a-fact-heavy-turn-can-cost-more-than-keeping-it` is where it bites. A ten-token
turn carrying three facts costs 30 tokens to summarise. Dropping it makes the transcript
*larger*, and a compactor that assumes freeing tokens is monotone will drop turns forever
and never converge.

`the-summary-cost-counts-against-the-budget` is the same shape one step further along:
dropping the fact-heavy turn alone leaves you over, so the turn after it goes too — and
the run ends up with no transcript and a summary, which is a real outcome that a naive
"drop until it fits" reports as success without noticing it deleted the conversation.

**No fact is ever lost.** Every fact from every dropped turn appears in `summarised`.
That is the invariant compaction exists to hold: the transcript is disposable, what the
transcript established is not.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
