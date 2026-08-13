# Delayed Retry with Jitter

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Failure Patterns · Delayed Retry with Jitter](https://github.com/breim/agents-honestly/blob/main/content/docs/patterns/failure/delayed-retry-jitter.mdx)

Back off exponentially, and make sure everyone backs off differently.

## The task

Implement `delays(randoms, baseMs, capMs)`, returning one delay per attempt.

```
window(n) = min(baseMs * 2^(n-1), capMs)      attempts 1-based
delay(n)  = floor(randoms[n-1] * window(n))    full jitter
```

Two things are load-bearing.

**Randomness is injected, not drawn.** `randoms` is supplied by the caller, which is why
this has boundary cases at all. A backoff built on a global generator cannot be tested
where it matters — at the cap, at zero, at the floor — and those are precisely the places
it goes wrong. In production you pass a real generator; the shape of the function does
not change.

**Full jitter, not a jittered fixed delay.** The delay is drawn from `[0, window)`, not
`window ± noise`. `full-jitter-can-draw-zero` looks wrong and is not: the point of jitter
is to *decorrelate* a thundering herd, and clients that all wait "about 400ms" still
arrive together. Spreading them across the whole window is what breaks the synchronisation
that a shared outage created in the first place.

`the-window-stops-doubling-at-the-cap` keeps the tail bounded — without it the sixth retry
waits 3.2 seconds and the tenth waits under a minute.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
