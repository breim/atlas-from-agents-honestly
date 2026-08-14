# Generative UI and Tool Approvals

**Tier:** drill — a self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part XIII · Interface · Generative UI and Tool Approvals](https://agentshonestly.com/book/interface/generative-ui-and-approvals)

The model picks the component. You wrote the component.

## The task

Implement `render(events, config)`, returning `{ frames, card }`.

Every event is a frame. `input_streaming`, `input_available`, and `executing` render a
`StatusLine`; `executing` grows a spinner once `elapsedMs` reaches `spinnerAfterMs`. An
`error` renders `ErrorState`. An `output_available` renders the registered component for its
tool, or the fallback.

A `gate` mints the card — once — with `placement` decided by whether the approver is the
session's driver, and renders an `ApprovalCard` at `pending`. The `approve_*` events move
that card through `submitted` and then `accepted` or `rejected`.

## The property

`the-receipt-appears-only-after-the-credit-does` is the case, and
`a-result-component-only-ever-appears-on-the-frame-that-has-the-result` is it as a rule.
Ordinary web practice says render the change immediately and reconcile after. For an agent
action that is wrong: an optimistically rendered *"Refund issued"* that then fails is not a
stale cache — it is a false statement made to a customer by a system they were told to
trust, and no subsequent correction fully retrieves it. Anything you show, you have said.

`approving-shows-submitted-before-accepted` is the same rule applied to the gate itself. A
card that vanishes the instant Approve is clicked has already told the reviewer their
decision took effect — and an update can still be rejected by a validator for staleness. So
the card reports that the decision was submitted, then that it was accepted, and
`an-approval-card-never-disappears-once-it-has-been-shown` keeps it on screen either way.

`the-card-is-rendered-once-and-every-surface-shows-those-bytes` is where two earlier
requirements meet. The audit record has to hold the *rendered* card, because re-rendering it
later produces a different card from state that has since moved. So render once at gate time
and store it: the inline view, the review queue, and the audit record all display the same
bytes, and none of them can disagree. Rendering live in each surface gives you three views
that can differ, one of which is the legal record.

`an-unregistered-tool-still-renders-something` is the registry row people omit. A tool with
no component still has to render, because the alternative is a blank space where a result
should be — and adding a tool should not require a UI deploy to avoid that.

`the-driver-approves-inline` and `someone-else-approves-from-a-queue` are one determinant,
not two policies. Chat is a cockpit, not a conveyor belt: inline confirmation is free when
the approver is already looking at the screen, and useless when nobody is in the chat.
Routing an interactive user's own action to a queue they will check tomorrow converts a
two-second confirmation into a day of latency for no safety gain.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
