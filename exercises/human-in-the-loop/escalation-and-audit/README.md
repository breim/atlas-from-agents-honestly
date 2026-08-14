# Escalation and Audit

**Tier:** build — this is a piece of Atlas. Self-contained, like every exercise here; the
narrative continues in the next build rather than the code.

**Chapter:** [Part XII · Human in the Loop · Escalation and Audit](https://github.com/breim/agents-honestly/blob/main/content/docs/human-in-the-loop/escalation-and-audit.mdx)

What happens when nobody answers, and what you can still prove eleven months later.

## The task

Implement `resolve(spec, event, policy)`, returning
`{ status, errors, outcome, queued, record }`.

A gate must answer three questions — what happens on silence, who the backup is, when it
expires — and its silence policy must be **deny**. Missing any of those is an undefined state
and nothing is recorded.

Otherwise: only an explicit approval approves. Every other event denies, and the denial is
classified as `judgement`, `timeout`, or `fault`. An auto-denial routes into a human queue; a
judgement denial does not. Write a record naming the reviewer (falling back to the backup), the
reasoning, the rendered card, whether the control was hard or soft, and a retention capped by
policy — flagging a record that has no card.

## The property

`every-way-of-not-answering-fails-closed-and-escalates` is the rule that has to hold for all
three faults at once. A timeout, an error, and a missing payload are three different bugs with
one correct answer: deny, and put it in front of a person. The answer to an unanswered approval
is never to ask again, because that spends more of the budget that was already scarce.
`nothing-but-an-explicit-approval-is-ever-approved` states the converse.

`a-timeout-denial-and-a-judgement-denial-are-told-apart` is the distinction that changes what
happens next. Somebody looked at this and said no; nobody looked at all. The first is a decision
the model should revise against, the second is a queue entry — and
`an-auto-denial-routes-to-a-human-and-a-judgement-denial-does-not` checks the routing follows
the classification rather than the outcome. Collapse them and the model revises reasoning that
nothing actually rejected.

`a-gate-that-approves-on-silence-is-refused` and `each-of-the-three-questions-is-required-on-its-own`
are the design-time checks. A gate that cannot say what happens when nobody responds has not
been designed, it has been drawn.

`a-record-without-the-rendered-card-proves-nothing` is the audit property, and its shape is
deliberate: the decision still stands, and the record is still written — but the gap is
reported. Storing a reference instead of bytes means re-rendering the card later, and a card
re-rendered against today's data is not the card the reviewer saw. That is the difference
between a log, which is for you while debugging, and an audit trail, which is for someone who
does not trust you, later.

`every-record-names-a-reviewer-falling-back-to-the-declared-backup` keeps an auto-denial from
being anonymous, and requires the hard-or-soft classification, because "it proceeded" is three
different stories about your controls.

`retention-is-capped-whatever-the-policy-asks-for` treats retention as a decision rather than
caution. The history is also a copy of every payload, so keep-everything-forever is an
accumulating liability.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
