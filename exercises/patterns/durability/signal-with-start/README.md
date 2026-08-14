# Signal With Start

**Tier:** micro. One pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Durability Patterns · Signal With Start](https://agentshonestly.com/book/patterns/durability/signal-with-start)

Deliver to the workflow, starting it if it does not exist, as one operation rather than
two.

## The task

Implement `signalWithStart(running, signals)`, returning `{ started, workflows }`.

For each signal: if its workflow is not running, start it and record the id in `started`.
Either way, append the payload to that workflow's queue. `workflows` maps each id to
the payloads it received, in arrival order.

The two properties:

- **A workflow is started at most once.** `two-signals-start-one-workflow` sends two
  signals to a workflow that does not exist yet, and `started` has one entry.
- **No signal is dropped.** `no-signal-is-ever-dropped-on-the-start-path` sends three
  to a cold workflow, and all three arrive in order. The signal that triggered the
  start is a signal, not just a trigger. Losing it is the classic version of this bug,
  and it looks like a ticket that exists but has no opening event.

Writing this as `if (!running) start(); signal();` produces the right answer here and
the wrong one in production, where two callers can both observe "not running" and both
start. That is what the atomic form exists to prevent, and why the operation has its
own name in the API rather than being two calls you make in a sensible order.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
