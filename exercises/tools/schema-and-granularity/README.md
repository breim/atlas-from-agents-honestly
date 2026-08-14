# Schema and Granularity

**Tier:** drill — a self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part VIII · Tool Engineering · Schema and Granularity](https://agentshonestly.com/book/tools/schema-and-granularity)

Review a tool schema the way you would review an API somebody else has to call blind.

## The task

Implement `assess(tool, knownFields, maxParams)`, returning `{ verdict, issues }`.

Four rules, reported in this order: `no_effect`, `multiple_effects`,
`undeterminable_param` (one per offending parameter, in declaration order), and
`too_many_params`.

`a-required-parameter-the-model-cannot-know-is-a-design-error` is the rule worth the
drill. `ledgerRowId` is an internal database key. Nothing in the conversation contains
it, no amount of prompting will produce it, and the model will not refuse to call the
tool — it will **invent** a plausible value, because filling a required field is what
the schema asked for. The failure lands in the ledger, not in the model.

`an-optional-unknowable-parameter-is-fine` is the escape hatch that keeps the rule
usable. The same field, marked optional, is a field the model can leave out and the
implementation can fill in itself.

`two-effects-in-one-tool-is-too-coarse` catches the other direction. A `manage_order`
that reads or cancels depending on a mode flag means the permission boundary, the
idempotency key and the approval requirement all differ by argument — so none of them
can be declared on the tool. Split it, and each half gets to say what it is.

`a-tool-with-no-effect-is-not-a-tool` closes the set: a tool that does nothing is
something the model can waste a step calling.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
