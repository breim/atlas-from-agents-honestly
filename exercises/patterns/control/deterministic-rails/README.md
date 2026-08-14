# Deterministic Rails

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Control Patterns · Deterministic Rails](https://agentshonestly.com/book/patterns/control/deterministic-rails)

The requests you already know the answer to should not be model calls.

## The task

Implement `handle(request, rails, model)`, returning `{ answer, source, modelCalls }`.

If a rail's `when` **exactly equals** the request's intent, answer from the rail with
`source: "rail"` and `modelCalls: 0`. Otherwise call `model(request)` once, with
`source: "model"` and `modelCalls: 1`.

`modelCalls` exists to be asserted. The test counts real invocations of the `model`
function, so an implementation that calls the model and then discards the answer in
favour of the rail passes every other check and fails this one — which is exactly the
bug worth catching, because it is invisible in the output and shows up only on the bill.

Three things a rail gives you that a model call cannot: the answer cannot drift between
releases, retrieved text cannot talk it into saying something else, and it costs nothing.
For "what are your opening hours" that is the entire requirement.

`an-intent-that-only-looks-railed-falls-through` pins exact matching. `order_status_v2`
is not `order_status`, and prefix matching here would hand a stale canned answer to a
request that meant something new.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
