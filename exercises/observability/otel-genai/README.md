# OpenTelemetry for GenAI

**Tier:** drill. A self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part XV · Observability · OpenTelemetry for GenAI](https://agentshonestly.com/book/observability/otel-genai)

You are not the only thing emitting spans.

## The task

Implement `collect(spans, config, providerTokens)`, returning
`{ kept, dropped, redacted, violations, tokens, tokensMatchProvider }`.

Keep a span only when its `emitter` is the declared owner of its `type`; everything else is
duplicate instrumentation. On kept spans, check every attribute key: a `gen_ai.*` key the
conventions do not define is `unknown_convention_key`, and a key in neither `gen_ai.*` nor
your namespace is `unnamespaced_key`. Report a span as `redacted` when it carries content
attributes and capture is off. Sum the usage tokens over kept spans and compare against the
provider.

## The property

`a-second-library-wrapping-the-model-call-is-dropped` is the failure that is easy to miss
because the trace looks *more* complete rather than broken: an extra `chat` span, plausibly
nested, emitted by a framework that also ships instrumentation. Keep it and your token count
doubles, and the number it corrupts is the one feeding cost attribution and cost per
resolved ticket.

`keeping-the-duplicate-would-have-broken-the-provider-check` is the ten-minute verification
the chapter prescribes, run as a property. For every case with a dropped span, the test
re-collects with the duplicate's emitter promoted to owner and confirms two things: the
tokens go up, and `tokensMatchProvider` goes false. Summed span tokens against the provider's
reported usage is what catches this, and nothing else does.

`a-model-span-nobody-emitted-shows-up-as-a-mismatch` is the same check in the other
direction. The SDK instrumentation was off, the trace looks fine, and 1,500 tokens are
unaccounted for.

`an-invented-convention-key-is-a-violation` and `the-same-fact-in-your-own-namespace-is-fine`
are the identical fact, which prompt version produced this call, placed once wrongly and
once correctly. The conventions cover the mechanical fields well and none of the fields
specific to your correctness story: prompt version, retrieved-document versions, truncation.
That is not a gap, it is the boundary of what a general convention can standardise. Use
`gen_ai.*` for what it defines and put yours in your own namespace.

`a-dropped-span-is-not-your-problem` keeps the report actionable: a span you discarded is
somebody else's library, and its attribute hygiene is not a finding you can act on.

`content-is-not-captured-by-default` is the setting that keeps the observability bill and
the third copy of customer data from arriving on the same day.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
