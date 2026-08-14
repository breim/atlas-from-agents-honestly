# Long-Lived Agents

**Tier:** build — this is a piece of Atlas. Self-contained, like every exercise here; the
narrative continues in the next build rather than the code.

**Chapter:** [Part XI · Durability in Practice · Long-Lived Agents](https://github.com/breim/agents-honestly/blob/main/content/docs/durability/long-lived-agents.mdx)

One execution per case, alive for the whole lifetime, and the four things that go wrong there.

## The task

Implement `live(events, config, codeVersion)`, returning
`{ status, batches, recycles, historyEvents, historyBytes, warnings }`.

Accumulate messages into a buffer and act once when a quiet window elapses — a window each new
message **restarts**. Close on a close event. Expire on the absolute deadline. Recycle the
history when it approaches its cap, keeping `headroomEvents` in hand, draining the buffer before
crossing and recording what was carried. Warn when a case is still open and when the raw
transcript crosses a recycle.

## The property

`a-burst-of-messages-produces-one-reply` is the behaviour customers notice. People type in
bursts, so handling each message separately produces several contradictory replies to what was
really one thought. `a-new-message-restarts-the-window-rather-than-extending-a-fixed-one` is the
sharper version: a customer who keeps typing just under the window gets **one** answer, not four
— which is why the window is a restarting quiet period rather than a batch timer.

`every-message-is-acted-on-exactly-once-in-order` is the invariant underneath all of it, checked
against the arrivals rather than against the batches.

`the-history-recycles-with-headroom-before-the-cap` is the rule that looks like paranoia until
it bites: draining generates events, so a workflow that waits for the ceiling to recycle can
terminate itself trying. `a-recycle-happens-with-headroom-never-at-the-ceiling` bounds it from
both sides, so recycling far too early is a failure too.

`a-recycle-mid-burst-drains-what-was-buffered` is the pair of behaviours that are easy to
conflate. Signals sent *during* the transition are buffered and safe; signals already pending
are **lost** unless drained. The test asserts that every message that arrived is still acted on
across the boundary.

`carrying-the-raw-transcript-across-a-recycle-is-warned` is where the compaction decision from
Part III finally has to be made, because what crosses the boundary is the input. The property
runs all three choices and warns about exactly one: prefer a reference and a cursor over a
summary, and a summary over the raw transcript.

`an-absolute-deadline-expires-the-case` is the timer bug with a long fuse. A relative sleep
restarts on every transition, so a busy case never reaches its own deadline — the test proves
the distinction by replaying the same events on a compressed clock and watching the expiry
disappear.

`a-case-that-never-closes-is-warned-about` is the operational one. An entity workflow with no
defined end runs until somebody notices it months later, and the warning names the code version
it is still running — because a long-lived execution keeps old code until it closes or recycles.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
