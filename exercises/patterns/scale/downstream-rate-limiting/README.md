# Downstream Rate Limiting

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Scale Patterns · Downstream Rate Limiting](https://github.com/breim/agents-honestly/blob/main/content/docs/patterns/scale/downstream-rate-limiting.mdx)

Your provider's quota is not yours to exceed, and finding out by being throttled is expensive.

## The task

Implement `admit(arrivals, capacity, refillMsPerToken)`, returning `{ admitted, rejected }`
as lists of arrival times.

A token bucket: it starts full, each admitted request spends one token, and tokens refill
continuously — one every `refillMsPerToken` milliseconds — capped at `capacity`.

Two properties worth the cases:

- **A burst up to capacity gets through; the next one is shed.** That is the whole
  reason for a bucket rather than a flat rate: real traffic is bursty, and a limiter
  that smooths every burst adds latency to requests it could have served.
- **A partial refill is not a token.** `a-partial-refill-is-not-a-whole-token` waits half
  a refill period and is still rejected. Rounding up here is how you end up sending 1.4×
  your quota and blaming the provider.

`refill-is-capped-at-capacity` is the one people miss: idling for a long time does not
bank credit. Without the cap, an agent quiet overnight wakes up with ten thousand tokens
and takes the downstream service down at 9am.

Note that time is a parameter and refill is expressed in **milliseconds per token**
rather than tokens per millisecond. That keeps the arithmetic exact in binary floating
point, so TypeScript and Python agree on the boundary instead of disagreeing in the
last bit.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
