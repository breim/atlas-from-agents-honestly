# Continue-As-New for Memory

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Durability Patterns · Continue-As-New for Memory](https://github.com/breim/agents-honestly/blob/main/content/docs/patterns/durability/continue-as-new-memory.mdx)

A workflow history is finite. A conversation is not.

## The task

Implement `run(events, maxEvents, keepRecent)`, returning
`{ generation, summary, recent, events }`.

For each event: append it to `recent`, and push the overflow into `summary` so `recent`
never exceeds `keepRecent`. Count events against the current run's history; when the
count reaches `maxEvents`, continue as new — increment `generation` and reset the count
to zero.

`events` is the **current run's** history size, not the total. That is the whole point:
it resets, and the conversation carries on in a fresh run with the state it chose to
bring. `a-long-conversation-continues-more-than-once` runs six events through a limit of
three and ends on generation two with an empty history.

**Nothing is lost.** `summary` concatenated with `recent` is always every event so far,
in order — `nothing-is-lost-across-a-continuation` asserts exactly that across a
continuation boundary. Continue-as-new is the one operation that can silently amputate
an agent's memory, because the new run starts with precisely what you passed it and no
error is raised for what you forgot.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
