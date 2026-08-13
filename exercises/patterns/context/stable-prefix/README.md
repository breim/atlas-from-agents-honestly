# Stable Prefix

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Context Patterns · Stable Prefix](https://github.com/breim/agents-honestly/blob/main/content/docs/patterns/context/stable-prefix.mdx)

Put what never changes at the front, because caching only ever works forwards.

## The task

Implement `order(blocks)`, returning `{ ordered, prefixTokens }`.

Each block is `{ id, tokens, volatile }`. Stable blocks go first, volatile blocks after,
and **relative order within each group is preserved**. `prefixTokens` is the number of
tokens that stay cacheable — the sum of the stable blocks.

The rule looks cosmetic and is not. Prompt caching matches on a prefix, so one changed
byte invalidates every token after it. A timestamp sitting above a four-hundred-token
system prompt does not cost ten tokens, it costs seven hundred, on every call, forever.
`moves-a-volatile-block-to-the-back` is that bug in three lines of fixture.

A stable sort is the entire implementation. Reaching for a comparator that returns
`volatile ? 1 : -1` fails `preserves-relative-order-within-each-group` on any runtime
whose sort is not stable, which is why the case exists.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
