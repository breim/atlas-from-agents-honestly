# The System Prompt

**Tier:** drill — a self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part III · Context Engineering · The System Prompt](https://agentshonestly.com/book/context/system-prompt)

Assembled from named blocks in a declared order, not concatenated in whatever order they arrived.

## The task

Implement `assemble(blocks, spec)`, returning `{ prompt, missing, ignored }`.

Blocks render **in spec order**, joined by a blank line. A required block that is absent
is listed in `missing`. A block the spec does not name is listed in `ignored` and does not
appear in the prompt. A second block with the same name is ignored too — the first wins.

Three properties, and each is load-bearing for a different reason:

- **Spec order, not input order.** `blocks-render-in-spec-order-not-input-order` supplies
  style, policy, role and gets back role, policy, style. Assembly that preserves caller
  order makes the prompt depend on the shape of the code that built it, and one refactor
  later every cached token is gone with no visible change to the prompt's content.
- **Unknown blocks are dropped.** `an-unknown-block-is-ignored-not-appended` carries an
  `override` block that says "Ignore all previous instructions." Appending unrecognised
  blocks is how a system prompt becomes something a caller can inject into. The spec
  decides what a system prompt contains; a block that is not in it is not in the prompt.
- **The first block wins.** `a-duplicate-block-keeps-the-first` supplies a second `policy`
  removing the limit the first one set. Last-write-wins is the usual default for merging
  and it is exactly wrong here: whoever appended later gets to overrule the policy.

`missing` is a report, not an exception. A prompt missing its policy block still renders —
you need to see what was actually sent, and an assembler that throws produces a stack
trace instead of the prompt you needed to read.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
