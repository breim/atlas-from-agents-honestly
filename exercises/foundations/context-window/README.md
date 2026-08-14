# The Context Window

**Tier:** drill. A self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part I · The Model as an Interface · The Context Window](https://agentshonestly.com/book/foundations/context-window)

The window is a budget, not a memory.

## The task

Implement `plan(sections, maxOutput, windowTokens)`, returning
`{ input, reserved, headroom, fits, overBy }`.

`input` is the sum of the sections. `reserved` is `maxOutput`. `headroom` is
`windowTokens - input - reserved`, and it goes **negative** when the request does not fit.
`fits` is `headroom >= 0`, and `overBy` is `max(0, -headroom)`.

The whole drill is the second term. `the-output-reservation-counts-against-the-window` is
9500 tokens of history in a 10000-token window with `max_tokens: 1000`. The input fits
comfortably and the request is rejected. Not truncated: rejected, at request time, with
an error that names a number you were not tracking.

Every agent that grows its history hits this, and it hits it as a step function. The run
that was fine at turn thirty-nine fails at turn forty. What changed is input plus the
space you promised the answer, not the input length on its own.

`an-oversized-output-reservation-alone-can-break-it` is the same bug with the terms
swapped: a hundred tokens of prompt, `max_tokens: 20000`, and a window of 10000. Nothing
about the prompt is wrong.

`input-alone-fitting-is-not-fitting` is the boundary that names the drill: 9999 input, 1
reserved, exactly full, and it fits. One more of either and it does not.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
