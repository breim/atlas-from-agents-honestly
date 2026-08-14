# Prompt Caching and Prefix Stability

**Tier:** drill. A self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part I · The Model as an Interface · Prompt Caching and Prefix Stability](https://agentshonestly.com/book/foundations/prompt-caching)

Work out which of your requests would actually have hit the cache.

## The task

Implement `replay(requests, minCacheTokens, ttlMs)`, returning
`{ hits, misses, hitRateBps }`. The first two are indexes into the request list, and the
hit rate is in basis points, rounded with `floor(x + 0.5)`.

A request hits when its prefix matches the live cache entry **and** that prefix is at
least `minCacheTokens`. A hit or a miss both refresh the entry, so the TTL measures
**idle time, not age**.

Three things this drill exists to correct, and all three make estimates too optimistic:

- **The minimum.** `a-prefix-below-the-floor-is-never-cached` repeats a 500-token prefix
  and never hits, because providers do not cache below a floor. A back-of-the-envelope
  that ignores it predicts savings on exactly the small prompts that get none.
- **Idle, not age.** `traffic-keeps-an-entry-alive-past-its-ttl` runs 400 seconds against
  a 300-second TTL and hits twice, because a request every 200 seconds keeps refreshing
  it. Treating the TTL as time-since-creation under-counts hits on busy prefixes and
  over-counts them on quiet ones.
- **A changed prefix is a new entry.** `a-changed-prefix-misses-and-becomes-the-new-entry`
  costs a miss when the system prompt changes, and then hits again. That is one bad
  request per deploy, not a permanent regression, and worth knowing before you decide
  never to touch the prompt.

`exactly-at-the-ttl-is-expired` and `exactly-at-the-floor-is-cached` pin the two
comparisons in opposite directions.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
