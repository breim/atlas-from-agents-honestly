# Grounded Citations

**Tier:** micro. One pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Retrieval Patterns · Grounded Citations](https://agentshonestly.com/book/patterns/retrieval/grounded-citations)

Every sentence you show the user traces to something you actually retrieved.

## The task

Implement `ground(claims, sources)`.

For each claim, keep only the citations naming a retrieved source, deduplicated, in the
order given. **Drop the claim entirely if nothing survives.** Surviving claims keep
their original order.

The two failures are different and both matter:

- **A citation to a source that was never retrieved** is the most convincing-looking
  output the system can produce. It has a document id in it. Stripping it is the easy half.
- **A claim left with no citation** is the half people skip, because the answer still
  reads fine. It just quietly stopped being grounded. `a-claim-citing-only-unknown-sources-is-dropped`
  fails any implementation that filters the citation list and returns the claim anyway.

Note that `ground` never edits claim text. A claim is kept whole or not at all; deciding
which half of a sentence was supported is not a job for a filter.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
