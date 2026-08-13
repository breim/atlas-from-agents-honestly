# The Loop, By Hand

**Tier:** build — adds a capability to the running Atlas system. Later chapters build on what you write here.

**Chapter:** [Part II · From LLM to Agent · The Loop, By Hand](https://github.com/breim/agents-honestly/blob/main/content/docs/first-agent/the-loop-by-hand.mdx)

Atlas v0 in about eighty lines. No framework, no magic, every decision visible.

## The task

Implement `runLoop({ script, tools, maxSteps })`.

The model is a **script**, not a provider. Each entry is either a tool call
(`{ tool, input }`) or a final answer (`{ text }`), and the loop consumes one entry
per step. That is what makes every assertion below exact instead of sampled — the
suite runs with the network down.

Return:

```ts
{ status: 'completed' | 'bounded', steps: number, answer: string | null, trace: Array<{ tool, ok }> }
```

Four decisions the test is checking, and each is a way real loops fail:

- **`steps` counts model calls, not tool calls.** A run that answers straight away
  took one step, not zero.
- **An unknown tool is an observation, not an exception.** The model asked for
  `refund_everything`; the loop records `ok: false` and keeps going, and the next step
  still answers. A loop that throws here hands the reader a stack trace instead of a
  recovery.
- **The bound is a ceiling on model calls.** `never-stops` scripts ten tool calls
  against a bound of eight and must stop at eight with no answer.
- **The bound applies even when the next entry would have answered.** `bound-of-one`
  fails any implementation that checks the bound after consuming a turn it had no
  budget for.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.

## What replaces this later

The loop you write here is the thing Part VII turns into an explicit graph and Part X
turns into a workflow. The contract in `expected.json` does not change when it does —
that is the point of writing it by hand first.
