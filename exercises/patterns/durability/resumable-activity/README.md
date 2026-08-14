# Resumable Activity

**Tier:** micro. One pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Durability Patterns · Resumable Activity](https://agentshonestly.com/book/patterns/durability/resumable-activity)

A retry should finish the work, not start it again.

## The task

Implement `process(items, checkpoint, failAt)`, returning `{ ok, processed, checkpoint }`.

Resume immediately **after** the checkpointed item and process forward. On failure,
return the checkpoint of the last item that actually completed. `processed` lists only
what this attempt touched.

The property is **exactly-once across attempts**. `a-failure-checkpoints-what-completed`
and `a-retry-after-a-failure-finishes-the-work` are the same run in two halves: the
first attempt does `a`, `b` and dies on `c`; the retry starts with checkpoint `b` and
does only `c`. Concatenate the two `processed` lists and you get each item once. An
implementation that checkpoints the *failing* item instead of the last successful one
skips `c` forever, and the batch quietly comes up one short.

`no-item-is-ever-processed-twice` is the degenerate retry: everything was already done,
so the correct amount of work is none. An activity that cannot recognise a completed
checkpoint reprocesses the whole batch on every retry, which is how a duplicate-charge
incident starts.

`an-unknown-checkpoint-restarts-from-the-beginning` is a judgement call worth naming:
a checkpoint nobody recognises is treated as no checkpoint. Reprocessing is recoverable
if the work is idempotent; silently skipping the batch is not.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
