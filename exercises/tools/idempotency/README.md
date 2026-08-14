# Idempotency

**Tier:** build — this is a piece of Atlas. Self-contained, like every exercise here; the
narrative continues in the next build rather than the code.

**Chapter:** [Part VIII · Tool Design · Idempotency](https://github.com/breim/agents-honestly/blob/main/content/docs/tools/idempotency.mdx)

The refund call timed out. This is the design where the answer stops mattering.

## The task

Implement `canonical`, `idempotencyKey` (`idempotency_key` in Python) and `dispatch`.

The key is `sha256(runId|tool|canonical(args))`, truncated to `keyLength`. `canonical` sorts the
argument names and joins `name=value` pairs with `&`, because an unstable serialization is an
unstable key. Arguments are flat strings and integers, so both tracks derive byte-identical
keys.

Then dispatch each attempt:

- an argument named in `reservedArgs` is **refused** — the key is not something the model
  supplies;
- a key already in the ledger comes back `already-applied`, with a note, and nothing runs;
- a `rejected` transport records nothing, because nothing happened;
- an `ok` transport applies and records;
- a `timeout` applies and records too, and reports `unknown`.

## The property

`a-timeout-then-a-retry-moves-the-money-once` is the whole chapter in two attempts. The first
call times out; the second is the model deciding, from an error in its transcript, to try again.
The ledger has one entry and `effects` is 1. `a-timeout-is-recorded-as-landed-because-that-is-the-way-it-leans`
states the part people get backwards: most timeouts happen on the *response*, so the server did
the work and the reply was lost. "Unknown" is not a coin flip — it skews toward *it happened*,
which is the direction that costs money, so the ledger records it and the caller is told plainly
that it does not know.

`repeating-an-attempt-any-number-of-times-never-adds-an-effect` is the invariant stated over
every case at once: run the whole sequence three times over and the ledger is identical. That is
what "make the question stop mattering" means operationally.

`the-model-repeating-itself-is-told-that-nothing-changed` is the row that separates this from
ordinary distributed-systems dedup. Your infrastructure knows it is repeating; the model does
not, because from where it stands this is a fresh judgement about what to do next, made with no
memory of a call in flight. So dedup is silent for a retry policy and must **never** be silent
here — the repeat comes back saying it was already applied, which is how the model stops asking.
`a-repeat-is-told-it-was-already-applied-and-is-never-silent` enforces that every dedup carries
a note and a key.

`a-key-supplied-by-the-model-is-refused` is the sibling of the authority rule from two chapters
back. The model cannot supply a stable key on a second call, because doing so would require
knowing there was a first — ask for one anyway and you get an invented identifier with a new
name. The property version injects each reserved argument into every attempt and requires all of
them refused, with nothing applied.

`the-key-is-a-function-of-the-run-the-tool-and-the-arguments-and-nothing-else` pins all three
terms independently: change the run, the tool, or any argument and the key moves; reorder the
arguments and it does not. `a-different-run-never-reuses-another-runs-key` is why the run is in
there — the key is scoped to one job, so ticket 9100 asking for the same credit as ticket 8823
is a second credit, not a duplicate.

`a-rejection-leaves-the-key-free-so-the-identical-call-may-still-land` is the boundary on the
other side. A 4xx before anything happened must not consume the key, or a corrected retry would
be silently swallowed.

`an-existing-ledger-is-honoured` is the crash case: hand a second process the first one's ledger
and it recognises the work rather than repeating it.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
