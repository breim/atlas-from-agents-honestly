# One Call, Then Structure

**Tier:** build — this is a piece of Atlas. Self-contained, like every exercise here; the
narrative continues in the next build rather than the code.

**Chapter:** [Part II · From LLM to Agent · One Call, Then Structure](https://agentshonestly.com/book/first-agent/one-call)

The smallest useful thing, and the number that tells you exactly where its ceiling is.

## The task

Implement `triage(tickets, routes)`, returning `{ routed, scoreboard }`.

Route every ticket by looking its predicted category up in the table. Then score the run
against what each ticket actually was: category, entities, destination, self-report, and
whether one call **resolved** it — which requires both that the ticket was genuinely
answerable from its own text and that the category was right.

The model's classification is scripted in the fixture. What you are building is the part
around the call.

## The property

`a-classifier-that-is-never-wrong-still-resolves-nothing-when-nothing-is-answerable` is the
whole lesson of the chapter, as an assertion. Give the classifier the ground truth as its own
prediction — perfect on every axis — and if no ticket can be answered from its own text,
`resolved` is still zero. The classifier is excellent at its job and resolves nothing, because
every one of those tickets needs a document, a row, or an action that a single call does not
have. That is real value shipped and a hard ceiling, and now you know where it is instead of
guessing.

`two-categories-that-share-a-queue-still-route-correctly` separates two measurements that
usually move together and are not the same thing. The label was wrong and the ticket still
reached the right people. `a-correct-category-always-routes-correctly` states the one-way
implication that holds regardless of the table.

`a-self-report-that-disagrees-with-reality` is `answerable_from_ticket_alone` being what it
is: the model's own assessment of whether this call was sufficient. `the-self-report-decides-nothing`
proves the code treats it that way — flip it on every ticket and the routing and every other
score are unchanged. It is scored, because a self-report that tracks reality is a useful
signal. It is never trusted, because it is a self-report.

`an-oblique-order-reference-costs-an-entity-not-a-category` is the two tickets in twenty that
mention an order without naming it. The classification survives; the extraction does not, and
the extraction is what the next chapter needs in order to look anything up.

Note what this is not. There is no loop, no tool, and no decision about what happens next —
the model is a classifier inside a function you wrote, control flow is entirely yours, and the
blast radius is zero because it has no tools.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
