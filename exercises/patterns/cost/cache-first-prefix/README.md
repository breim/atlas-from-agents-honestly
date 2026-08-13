# Cache-First Prefix

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Cost Patterns · Cache-First Prefix](https://github.com/breim/agents-honestly/blob/main/content/docs/patterns/cost/cache-first-prefix.mdx)

Caching matches forwards from the first byte, and stops at the first difference.

## The task

Implement `price(previous, current, pricing)`, returning `{ cached, fresh, micros }`.

The cached run is the leading blocks of `current` that are byte-identical to `previous` —
same id, same token count, same hash. Everything from the first difference onward is
paid fresh. Cached tokens bill at `cacheRead`, fresh tokens at `cacheWrite`, both in
micro-dollars per token. Round with `floor(x + 0.5)`, not the language's `round`.

`a-tiny-change-at-the-front-costs-the-whole-suffix` is the case worth staring at. A
ten-token timestamp changes, and the bill goes from 303 micro-dollars to 3788 — a
twelvefold increase caused by ten tokens. The system prompt underneath it did not change
at all, and it is paid for in full, on every request, forever.

That is the same fact as [Stable Prefix](../../context/stable-prefix), priced. The
ordering exercise tells you *which* blocks belong at the front; this one tells you what
it costs when you get it wrong, and the answer is not proportional to the mistake.

`a-block-that-shrinks-breaks-the-prefix-there` covers the other direction: dropping a
trailing block keeps the prefix that survived. The cache does not care what came after.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
