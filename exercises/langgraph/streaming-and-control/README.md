# Streaming and Control

**Tier:** drill. A self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part VII · Agent & Graph Engineering · Streaming and Control](https://agentshonestly.com/book/langgraph/streaming-and-control)

Assemble a token stream back into a result, and know whether it finished.

## The task

Implement `assemble(chunks)`, returning `{ text, toolCalls, complete }`.

`text` chunks append to the answer. `tool_start` opens a call, `tool_arg` appends to its
arguments, `tool_end` closes it. `done` means the stream finished cleanly. **A stream
without `done` is incomplete**, and an **open tool call at the end is never emitted**.

`a-stream-cut-short-is-incomplete` is the failure this drill is about. The text reads
"Your order was", a grammatical fragment that a caller treating it as a final answer
will happily show to a user. Nothing errored. The socket closed, the provider timed out,
or a proxy trimmed the response, and every byte that did arrive is perfectly valid. Only
the missing terminator distinguishes a truncated answer from a complete one.

`an-unclosed-tool-call-is-never-emitted` is the same fact with teeth. The stream stopped
mid-arguments on `issue_credit` with `{"cents":90`, which parses as nothing. A
lenient assembler that emits what it has hands the dispatcher a credit call with
truncated arguments. `a-closed-call-survives-a-later-truncation` keeps that from being
overcautious: the call that *did* close is real and is kept.

Note that `complete: false` is not an error. It is a fact the caller needs, and the caller
decides what to do about it: retry, show a partial with an indicator, or discard.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
