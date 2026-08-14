# Structured Output

**Tier:** drill. A self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part I · The Model as an Interface · Structured Output](https://agentshonestly.com/book/foundations/structured-output)

Getting data out of a model without a regex and a prayer.

## The task

Implement `parse(text, schema)`, returning `{ ok: true, value }` or
`{ ok: false, error }`.

Extract the span from the first `{` to the last `}` and parse it. Then validate: every
schema field present and of the declared type, and **nothing outside the schema**. Errors
are checked in the order `no_json`, `malformed_json`, `missing_field:<name>`,
`wrong_type:<name>`, `unknown_field:<name>`.

**No coercion.** `a-wrong-type-is-rejected-not-coerced` has `"5000"` where a number
belongs. `Number("5000")` is 5000 and everything downstream works, until the day the
model writes `"five thousand"` and the same code produces `NaN`, which propagates as a
credit of `NaN` cents rather than an error anybody can see. A string where a number
belongs means the model misunderstood the schema, and that is worth knowing on the first
occurrence rather than the hundredth.

**Unknown fields are rejected, not ignored.** `an-unknown-field-is-rejected` has the model
supplying a `tenantId` nobody asked for. Ignoring extras is the friendly default and it
is how a model widens its own scope: the field is silently dropped here, and the next
version of the code that reads the parsed object picks it up.

The extraction rule is deliberately crude: first brace to last brace. It handles prose
and fenced blocks without parsing either, and it fails loudly on anything stranger, which
is the correct trade for a function whose job is to be certain.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
