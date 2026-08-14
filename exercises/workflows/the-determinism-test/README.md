# The Determinism Test

**Tier:** drill — a self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part VI · Workflows Before Agents · The Determinism Test](https://github.com/breim/agents-honestly/blob/main/content/docs/workflows/the-determinism-test.mdx)

Three questions, asked before any code exists.

## The task

Implement `classify(signals)`, returning `workflow`, `workflow-with-model-steps`, or
`agent`.

- Steps unknown, or branches you cannot enumerate → **agent**.
- Structure known, some step needs judgement → **workflow-with-model-steps**.
- Structure known, no judgement needed → **workflow**.

`needing-a-model-does-not-make-it-an-agent` is the entire drill, and it is the mistake
this chapter exists to prevent. A step that reads a free-text ticket and picks a category
needs a model. It does not need an agent — it needs one model call inside a control flow
you wrote, that you can test, that fails in ways you enumerated, and that costs one call
rather than a loop of them.

The two questions that *do* produce an agent are about **structure**, not intelligence.
You reach for an agent when you cannot write down what happens next: when the steps
depend on what earlier steps found, and the branches are open-ended enough that a
`switch` would be a lie.

`unknown-structure-outranks-the-judgement-question` fixes the precedence. Once the shape
is unknown, whether a step needs judgement is not the deciding question any more — you
are building an agent either way, and the only thing left to choose is how tightly to
bound it.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
