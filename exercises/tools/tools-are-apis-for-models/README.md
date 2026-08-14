# Tools Are APIs Designed for Models

**Tier:** build. This is a piece of Atlas. Self-contained, like every exercise here; the
narrative continues in the next build rather than the code.

**Chapter:** [Part VIII · Tool Design · Tools Are APIs Designed for Models](https://agentshonestly.com/book/tools/tools-are-apis-for-models)

Curating a tool surface out of an existing API, and measuring what curation actually buys.

## The task

Implement `surface(endpoints, design, policy)`, returning
`{ tools, rejected, warnings, generated, curated }`.

Each proposed tool names a **job**, which is one or more endpoints called in a fixed order. It
also names the fields it returns and the arguments the model may choose. Reject it when:

- an argument is one of `identityFields`;
- the description is shorter than `minDescriptionWords`;
- the job names an endpoint that does not exist;
- it returns a field no endpoint in its job produces.

Warn, without rejecting, when a tool states no boundary, and when the accepted surface exceeds
`maxLiveTools`.

Then report both surfaces: `generated` is what pointing a generator at the spec would produce:
one tool per endpoint, every field returned. `curated` is what you actually shipped.

## The property

`a-fixed-chain-of-endpoints-becomes-one-tool-and-one-round-trip` is the whole argument as one
number. Four endpoints, three of them chained, become one tool: **one** round trip instead of
four, and **116** tokens in the window instead of **2,177**. For a programmer that chain is
three lines in a client function; for an agent it is three round trips of latency, three model
calls billed, and three complete JSON payloads that stay in the context for the rest of the
conversation. `consolidating-a-chain-trades-endpoints-for-round-trips` asserts the direction and
the order of magnitude rather than the exact figure, so the lesson survives a fixture edit.

`wrapping-every-endpoint-one-to-one-buys-nothing` is the control, and it is the one worth
sitting with: four perfectly reasonable tools, each well described, each with a stated boundary,
all accepted, and `curated` comes out **identical to `generated`** on every axis. Nothing was
wrong with any individual tool. The surface is still the API. That is what shipping the
generated output looks like when it is done carefully, and it is the step to skip.
`the-generated-surface-does-not-depend-on-what-you-designed` keeps that baseline honest: it is a
property of the API, so it cannot drift to flatter a design.

`an-identity-argument-is-rejected-however-it-is-named` is the rule with no exceptions. The model
chooses every value in `input`, which is what a tool call *is*, so the schema may contain only
things it is allowed to choose. The subject (`accountId`) is a legitimate model decision and the
capability you bought; the requester is not a decision at all. The property version injects each
identity field into **every** design in the fixture and requires all of them to be refused,
because a model that has just read a document mentioning another account will ask about that
account next, entirely without malice.

`a-description-too-thin-to-route-on-is-rejected` treats the description as what it is: shipped
code, re-sent on every request, and the only thing standing between two tools that could both
plausibly answer a question. The property version walks the threshold at `n-1`, `n`, `n+1` so
the comparison cannot be off by one.
`a-tool-that-states-no-boundary-is-warned-not-rejected` is the softer half. Saying what a tool
is *not* for is what stops the model picking inconsistently, and inconsistently is worse than
wrongly because it makes the behaviour untestable.

`a-field-no-endpoint-in-the-job-produces-is-rejected` is the check that keeps `returns` honest.
A tool cannot hand back what it never fetched, and
`an-accepted-tool-only-ever-returns-fields-its-own-job-produces` re-derives that from the
endpoint definitions rather than trusting the declaration.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
