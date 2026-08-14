# The AI SDK

**Tier:** build. This is a piece of Atlas. Self-contained, like every exercise here; the
narrative continues in the next build rather than the code.

**Chapter:** [Part XVII · Interface · The AI SDK](https://agentshonestly.com/book/interface/ai-sdk)

Where the loop lives, which bounds ship, and which stay yours.

## The task

Implement `place(runtime, shape, policy)`, returning
`{ status, errors, warnings, loopOwner, boundsOwned, boundsYours }`.

Refuse a Python interface layer, a runtime with no loop or more than one, a loop that does not
live where durability lives, a loop with no stop condition, and a loop with no step cap.

Warn, without refusing, about a cap larger than the declared shape suggests, about any bound
the policy says you own that nothing here bounds, and about the deprecated object API.

## The property

`exactly-one-loop-is-sound-and-none-or-several-are-not` is the placement decision as a count.
`ToolLoopAgent` is an agent loop, and so is a LangGraph graph, and so is a Temporal workflow.
Adopt all three and you have three step counters that disagree, each convinced it is in charge.
`the-loop-must-live-wherever-durability-lives` runs the full three-by-three matrix and accepts
only the diagonal, which with a durable backend means neither framework's loop.
`with-no-durable-backend-any-single-owner-is-acceptable` keeps that from being dogma: the rule is
about *agreement*, not about a particular vendor.

`cost-and-deadline-are-warned-about-unless-you-bound-them-yourself` is the honest reading of what
the SDK ships. Two first-party stop conditions exist, step count and a terminal tool call, and
neither notices an expensive step or a passing deadline.
`a-step-cap-does-not-stand-in-for-a-cost-or-deadline-bound` is the sharpest version: a loop with
a cap of **one** still gets both warnings, because a single step can cost anything.
`only-the-first-party-conditions-are-counted-as-owned-by-the-SDK` stops the report from
flattering the framework.

`a-loop-with-no-stop-condition-or-no-cap-is-unsound` is Part II's argument arriving as an API
parameter. The SDK requires a stop condition because a tool-augmented chat without one loops.

`the-step-cap-is-judged-against-the-shape-it-claims-to-be` walks every shape at its suggested
bound and one over. One step for one-tool-then-answer, five for chat, twenty for autonomous. A
chat-sized cap on a one-call shape is not an error, but it means the shape was misdeclared or the
cap was copied.

`python-is-refused-for-the-interface-layer-and-typescript-is-not` is why most production systems
end up split: TypeScript at the transport and UI boundary, Python for retrieval and evaluation.

`the-deprecated-object-API-warns-without-failing-the-placement` is deliberately a warning.
`generateObject` and `streamObject` are deprecated and slated for removal rather than already
gone, and a checker that refuses working code over a future removal gets turned off.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
