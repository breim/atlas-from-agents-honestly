# Freshness Routing

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Retrieval Patterns · Freshness Routing](https://github.com/breim/agents-honestly/blob/main/content/docs/patterns/retrieval/freshness-routing.mdx)

Some questions can be answered from an index built last night. Some cannot.

## The task

Implement `route(cachedAt, now, maxAge)`, returning `'cache'` or `'live'`.

`age = now - cachedAt`. The cache is used while `age < maxAge`, **strictly**. Two
boundary cases pin that down: exactly `maxAge` goes live, one millisecond under goes
to cache. A missing entry always goes live, and `maxAge: 0` therefore always goes live
too — which is how a caller disables caching without a second flag.

`a-clock-skewed-future-entry-is-fresh` is the one worth thinking about. A `cachedAt`
ahead of `now` yields a negative age, which is `< maxAge`, so it routes to cache. That
is the right call: skew between two machines is normal and small, and treating it as
infinitely stale would send every request live the moment a clock drifted forward.

Time is a parameter here, not a call to the system clock. A routing rule you cannot
test at its boundary is a routing rule you do not really have.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
