# One Tool, Then Many

**Tier:** build. This is a piece of Atlas. Self-contained, like every exercise here; the
narrative continues in the next build rather than the code.

**Chapter:** [Part II · From LLM to Agent · One Tool, Then Many](https://agentshonestly.com/book/first-agent/first-tools)

The round trip, by hand. No SDK, no framework, nothing hidden.

## The task

Implement `answer(ticket, script, catalogue, world)`, returning
`{ transcript, requests, rounds, answer, outcome }`.

Send the ticket. If the model asks for tools, echo its turn back, run every call it asked
for, return every result in one user message, and ask again. Record how many messages each
request carried.

A tool call resolves against the catalogue: find the tool by name, read its one argument out
of the call's input, and look `"<tool>:<value>"` up in `world`. A tool that is not in the
catalogue, a call missing its argument, and a lookup that finds nothing are all **results**,
not exceptions.

The model is scripted. What you are building is the machinery around the call, which is the
entire subject of the chapter.

## The property

`the-if-is-not-a-while` is the chapter's last section as an assertion. The script asks for an
account and then, having seen it, asks for an order, exactly the chaining that answering *"why
is the Acme account at risk"* requires. Your code handles one round, so the second request is
where it ends: `answer` is `null` and `outcome` is `unresolved`. The transcript stops with the
model asking a question nothing is listening to. `a-model-that-never-stops-asking-never-gets-past-the-second-request`
makes the bound explicit. The model can ask forever and there are still exactly two requests.
Changing that `if` to a `while` is the next chapter, and it is the whole difference between a
workflow with a model in it and an agent.

`every-issued-tool-use-id-comes-back-exactly-once-even-when-the-tool-failed` is the invariant
that a malformed conversation violates. `one-failure-does-not-drop-the-other-result` is the
tempting version of that bug: one call succeeded, one did not, and dropping the failure leaves
an issued id with no result. `a-failing-tool-returns-a-result-rather-than-throwing` is the
other half: `is_error: true` with text the model can act on. *"Error: get_order found no
record for 9999"* gets you an apology and a request for the right ID. `ORA-01722` gets you a
guess.

`the-assistant-turn-is-echoed-back-verbatim` proves the point that catches people who assume
the API remembers anything. It does not. The model has no memory of asking; the request is the
memory, `tool_use` blocks included. Summarising it or sending only the text is silently wrong.

`every-result-for-a-turn-arrives-in-one-user-message` is the failure with no error message
attached. Splitting parallel results across several user messages is accepted by the API and
teaches the model, from the transcript it is reading, to stop asking for parallel calls.

`the-second-request-resends-everything-the-first-one-sent` is the cost multiplier in code:
`requests` is `[1, 3]`, and the second one carries the system prompt, the schemas, the ticket,
the assistant's request, and the result. All of it, at input rates, for one visible answer.

`results-enter-the-transcript-as-user-content` is a one-line test with a long shadow. Your
database rows arrive in the same slot as the customer's words, with nothing marking them as
machine output. That is the structural reason prompt injection is a live problem rather than
a curiosity.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
