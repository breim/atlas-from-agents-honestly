# Updatable SLA Timer

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Durability Patterns · Updatable SLA Timer](https://agentshonestly.com/book/patterns/durability/sla-timer)

A deadline that can move, held by a workflow rather than a cron job.

## The task

Implement `runTimer(deadline, events, horizon)`, returning `{ fired, at }`.

Events arrive in time order. `extend` moves the deadline, `resolve` cancels the timer.
The timer fires at whatever deadline stands when that moment arrives; nothing that
happens afterwards can change it. `horizon` is how far the simulation runs — a deadline
beyond it has simply not fired yet, which is a different state from cancelled.

The property is **monotonic finality**: once fired, always fired.
`an-extension-after-the-timer-fired-is-ignored` and
`resolving-after-the-timer-fired-does-not-unfire-it` are the same bug from two angles.
An implementation that folds all the events first and *then* asks whether the final
deadline passed will happily un-fire a breach that already paged someone — and the
escalation it triggered still happened.

`an-extension-can-shorten-the-deadline` exists because "extend" is the operation's name,
not its contract. Setting a nearer deadline is legitimate, and an implementation that
guards with `to > deadline` silently ignores it.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
