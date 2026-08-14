# Output Guardrail

**Tier:** micro. One pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Security Patterns · Output Guardrail](https://agentshonestly.com/book/patterns/security/output-guardrail)

The last thing that reads the model's output before a person does.

## The task

Implement `guard(text, rules)`, returning `{ released, text, hits }`.

Each rule names a literal `pattern`, an `action` (`redact` or `block`), and a `label`.
Redaction replaces **every** occurrence with `[redacted:<label>]`. A `block` rule means
the response is not released at all: `released: false` and an empty `text`. `hits` lists
the labels that matched, in rule order, once each.

Three properties, and the middle one is the one that gets shipped broken:

- **Every occurrence, not the first.** `every-occurrence-is-redacted` has the hostname
  twice. A `replace` that takes the first match leaves the second in place, and the
  output looks redacted, which is worse than looking unredacted.
- **Blocking releases nothing, not a redacted version.** `a-blocked-response-releases-nothing-not-a-partial`
  wraps a credential in helpful-looking prose. Returning the surrounding text with the key
  removed treats a leaked credential as a formatting problem. The key is already in the
  transcript, the log, and possibly the cache. The correct move is to fail the response
  and rotate.
- **Blocking wins over redacting.** A response that trips both rules is blocked, and
  `hits` still reports both so the incident record is complete.

Literal patterns, not a classifier. A guardrail that guesses has false negatives you
never see; this one only catches what the run already knew was secret, which is the
part you can actually guarantee.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
