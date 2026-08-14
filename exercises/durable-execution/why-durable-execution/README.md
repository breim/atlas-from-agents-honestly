# Why Durable Execution

**Tier:** drill. A self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part X · Durable Execution · Why Durable Execution](https://agentshonestly.com/book/durable-execution/why-durable-execution)

The mechanism is simpler than its reputation. It is a journal and a replay.

## The task

Implement `run(program, journal, crashAfter)`, returning
`{ status, results, executed, journal }`.

Walk the program from the first step. If the journal already holds a recording at this
position, return the recorded result without executing anything. Otherwise run the step,
append its result to the journal, and carry on. `crashAfter` is how many *new* effects
complete before the process dies; a crashed run returns no results and keeps everything it
journalled.

The journal is positional. A recording whose name does not match the step at that position
is a non-determinism error.

## The property

`crashing-after-every-single-effect-still-runs-each-effect-exactly-once` is the guarantee,
and it is worth reading as a statement about the code you did not write. The function has no
resume handler, no `switch (state)`, no reconstruction of where it was. It starts at the
first line every time. Kill it after every effect, restart it from the journal, repeat until
it finishes. Each effect ran once, and the answer is the answer a clean run gives.

`recovery-does-not-re-run-a-journalled-effect` is that guarantee spending money.
`issue_credit` returned `cr_8823_1` and the process died before the reply went out. The
recovery run reaches that line, finds it in the journal, and returns the recorded credit id
without calling the ERP. This is the property a checkpointer cannot buy: a checkpointer
memoizes state *between* nodes, so the node re-runs whole. A journal memoizes the result of
every effect, so a completed effect never runs again.

`a-full-journal-makes-no-calls-at-all` is why catching up is cheap. Replay is microseconds
of in-memory work and zero external calls, which is what makes "re-run from the top" a
reasonable thing to do on every recovery.

`a-journal-that-does-not-match-the-code-is-a-replay-error` is the price. Replay compares the
sequence of effects, not their values, so it only works while the code produces the same
sequence. When it doesn't, the runtime cannot tell where in the program this execution
is, so it refuses to guess. Note that the diverged run writes nothing and executes nothing:
losing your place is not a licence to start acting.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
