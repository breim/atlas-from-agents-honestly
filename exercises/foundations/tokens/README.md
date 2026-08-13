# Tokens

**Tier:** drill — a self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part I · The Model as an Interface · Tokens](https://github.com/breim/agents-honestly/blob/main/content/docs/foundations/tokens.mdx)

What a token really is, why output costs several times more than input, and how to do the cost math from first principles.

## The task

Implement `costMicros(usage, pricing)` / `cost_micros(usage, pricing)`.

`usage` is the four counters a provider returns on every call — `input`, `output`,
`cacheWrite`, `cacheRead`. `pricing` gives US dollars per million tokens for each.
Return the cost as a whole number of micro-dollars.

Two things the test is actually checking:

- **The four rates are not interchangeable.** Output is five times input, a cache
  write costs more than an ordinary input token, and a cache read costs a tenth of
  one. Applying one blended rate passes nothing.
- **Rounding is `floor(x + 0.5)`.** Python's built-in `round()` is banker's rounding
  and disagrees with JavaScript's `Math.round` on exact halves. The `halves-round-up`
  case fails if you reach for the language default.

Prices and expected totals live in `expected.json`, shared byte-for-byte with the
Python track.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
