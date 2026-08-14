# Agent as Entity Workflow

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Durability Patterns · Agent as Entity Workflow](https://agentshonestly.com/book/patterns/durability/agent-as-entity-workflow)

One long-lived workflow per business entity, holding that entity's state for its whole life.

## The task

Implement `apply(signals)`, returning `{ notes, applied, ignored }`.

Fold the signals into the entity's state. A signal whose id has already been applied is
ignored. A signal of an unknown kind is ignored too — without failing the entity.

**Deduplication is by id, never by content.** The two cases either side of that line:

- `deduplication-is-by-id-not-by-content` sends two *different* signals that happen to
  carry the same value. Both apply. Deduping on payload would silently swallow the
  second real event.
- `a-duplicate-id-with-different-content-is-still-a-duplicate` sends the same id twice
  with different values. The first wins. A redelivery whose body changed is not an
  update; it is a redelivery you cannot trust, and the entity already committed.

`a-duplicate-arriving-much-later-is-still-caught` is why this is an entity workflow and
not a queue consumer with a short-lived cache. The duplicate arrives three signals later
and is still recognised, because the workflow that owns this entity is the same workflow
it was at the start — there is exactly one place that remembers, and it does not expire.

An unknown kind is ignored rather than fatal for the same reason: one malformed signal
must not take down an entity that will live for months.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
