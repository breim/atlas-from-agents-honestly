# Errors as Instructions

**Tier:** drill. A self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part VIII · Tool Engineering · Errors as Instructions](https://agentshonestly.com/book/tools/errors-as-instructions)

The model reads your error message and decides what to do. Write it for that reader.

## The task

Implement `instruct(code, catalogue)`, returning `{ message, retryable, fields }`.

A known code returns its catalogued instruction, whether a retry could help, and which
arguments to change. An unknown or missing code returns the generic message with
`retryable: false`.

Read the catalogue entries as prose. None of them describe what went wrong in the
system's terms: no status codes, no stack frames, no "constraint violation on
fk_order_id". Each one says **what the model should do next**: confirm the order number,
lower the amount, try the same call again. An error that only reports a fact leaves the
model to infer the remedy, and it will infer confidently and wrongly, most often by
retrying something that will never succeed.

`an-instruction-names-the-argument-to-change` is the difference between a message the
model can act on and one it can only apologise about. `amountCents` is named, so the next
call is a corrected call rather than a rephrased apology to the user.

`an-unknown-code-does-not-invite-a-retry` is the safe default and it is the strict one.
An error nobody wrote an entry for is an error nobody can promise will clear, and
defaulting to retryable turns every unhandled failure into three of them. Silence about
the remedy has to mean stop, not try again.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
