# PII, Audit, and Compliance

**Tier:** drill — a self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part XVII · Security · PII, Audit, and Compliance](https://agentshonestly.com/book/security/pii-and-compliance)

A classical application reads personal data. An agent copies it.

## The task

Implement `assemble(record, stores, vault)`, returning `{ prompt, exposure, unerasable }`.

Render each field the way its schema says: verbatim, as a stable pseudonym from the vault,
or omitted. Then work out what each store ends up holding: a store fed from the prompt
inherits whatever the prompt contained, and a store fed from the raw record holds every
personal field regardless. A store holding personal data with no subject key is unerasable.

## The property

`redacting-at-assembly-keeps-personal-data-out-of-every-copy` and
`redacting-at-the-trace-instead-is-one-step-too-late` are the same record twice. In the
first, the name is a handle and the email and card are omitted, so the provider, the
checkpointer, the trace, the eval set, and the memory store all hold nothing personal. In the
second the fields are verbatim, and all five hold both. Redacting on the way *into* the trace
store — the common implementation — arrives one step after the only irreversible moment in
the pipeline: the provider already has the unredacted version, and so does the checkpoint.

`pseudonymising-every-personal-field-empties-every-prompt-fed-store` is that as a rule, and
it is the whole reason to redact at assembly. One change, and every downstream copy inherits
the reduction for free.

`a-store-is-unerasable-exactly-when-it-holds-personal-data-with-no-subject-key` is the row
that turns an erasure request from a nine-minute ticket into an audit finding. Four of those
six stores were never a data-protection decision: they exist because someone was solving
durability, debugging, or quality, and they hold conversations keyed by thread rather than by
person. `giving-every-store-a-subject-key-makes-the-request-answerable` is the fix, and it
has to be designed in — you cannot retrofit a key onto a summary sentence.

`a-raw-store-holds-everything-whatever-the-prompt-said` is the honest limit. Assembly-time
redaction protects the *copies*; the source of truth still holds the real values, which is
correct, and is exactly where deletion is supposed to work.

`a-pseudonym-is-not-personal-data-in-the-prompt` is the technique that makes the rest
affordable. The model gets a handle it can carry through its reasoning and hand back as a
tool argument, your dispatcher resolves it, and the value never enters the prompt, the
checkpoint, the trace, or the provider. It is also shorter than the value and cannot be
hallucinated into a plausible wrong address — a privacy control that makes the agent slightly
better, which is rare enough to notice.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
