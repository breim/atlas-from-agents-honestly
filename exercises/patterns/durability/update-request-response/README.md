# Request-Response via Update

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Durability Patterns · Request-Response via Update](https://agentshonestly.com/book/patterns/durability/update-request-response)

A signal that answers — and that can say no before it changes anything.

## The task

Implement `applyUpdates(initial, updates)`, returning `{ state, responses }`.

Each update is validated **before** it mutates. Accepted updates return
`{ ok: true, value }` — the new credit total. Rejections return `{ ok: false, error }`
and leave the state exactly as it was. Rules: `cents` must be positive, the kind must be
known, and a closed workflow accepts nothing further.

The property is **atomicity per update**: validate, then mutate, never the reverse.
`a-rejected-update-leaves-the-state-untouched` is the assertion, and
`a-closed-workflow-refuses-further-credit` is the one that catches a real
implementation — it is tempting to add the credit and then check whether the workflow
was closed, because the check reads more naturally after you have the number.

This is what separates an update from a signal. A signal is fire-and-forget: the caller
learns nothing, so a rejected one is silence and the caller assumes success. An update
returns, which means the workflow can refuse and the caller can do something about it —
`a-rejection-does-not-stop-the-next-update` shows the caller correcting and succeeding.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
