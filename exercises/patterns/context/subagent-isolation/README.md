# Sub-Agent Context Isolation

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Context Patterns · Sub-Agent Context Isolation](https://agentshonestly.com/book/patterns/context/subagent-isolation)

A sub-agent gets the context its task needs, and returns the answer its caller asked for.

## The task

Two functions, because isolation has two directions:

- `isolate(parent, allow)` — the child's context, containing only the allowed keys.
  A key the parent does not have is simply absent, not `undefined`/`None`.
- `merge(parent, result, expose)` — the parent updated with only the exposed keys of
  the child's result.

The second one is what implementations forget. Filtering the way in feels like the
whole job, so the sub-agent's return value gets spread over the parent state and the
isolation you just built is undone in one line. `an-unexposed-key-cannot-overwrite-the-parent`
scripts a sub-agent returning both a leaked credential and a tenant id belonging to
somebody else, and the parent must come back untouched.

Neither function mutates its input.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
