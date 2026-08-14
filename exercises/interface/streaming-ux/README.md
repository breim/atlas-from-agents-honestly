# Streaming UX

**Tier:** drill. A self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part XIII · Interface · Streaming UX](https://agentshonestly.com/book/interface/streaming-ux)

The stream is a projection of the run, not the run.

## The task

Implement `serve(timeline, abandonAfterMinutes)`, returning
`{ status, buffer, deliveries }`.

Replay the timeline against one buffer. An `emit` takes the next id and is retained. A
`connect` receives every buffered event past its `lastEventId`, and `null` means from the
beginning. A `disconnect` removes a viewer and does nothing else. A `stop` cancels. `idle`
minutes accrue only while nobody is watching, and reaching the policy abandons the run.

A finished run keeps its buffer.

## The property

`a-refresh-resumes-where-it-left-off` is what the SSE spec gives you the hook for and does
not give you the mechanism for. The browser's automatic reconnection *reconnects*; it does
not *resume*. Left alone you get whatever the server sends next, with a hole where the
missed tokens used to be. Here `tab-1` comes back with `Last-Event-ID: 1` and receives
exactly `[2, 3]`, and `a-client-never-sees-the-same-event-twice-and-never-skips-one` says
that holds for every client in every case.

`a-refresh-never-starts-a-second-run` is the architectural claim underneath it, and it is
the one that goes wrong quietly. The buffer is always a prefix of what the run emitted, so
no connect can ever add to it. Conflate the stream with the run and a page refresh does not
resume a view. It starts a second agent, and now the customer has two runs against one
ticket, both spending money, and the one they are watching is not necessarily the one that
will write the answer. The tell is a route handler that starts work.

`a-disconnect-does-not-stop-the-run` and `a-run-is-never-cancelled-without-someone-saying-stop`
are the same rule from both ends. A dropped connection is ambiguous between refreshing,
switching tabs, going to lunch, a train entering a tunnel, and changing their mind. Only
the last is a cancellation. An agent that infers intent from a disconnect will abandon a
refund halfway through because someone's laptop slept, and the compensation it needs was
never written for a cancellation nobody made.

`nobody-returning-abandons-the-run-on-a-policy` is the third row of that table, and it is
deliberately not the second. Abandonment is a timeout decided in advance, not an inference
drawn from a socket closing, and `a-watched-run-never-goes-idle` and
`coming-back-resets-the-abandon-clock` are what keep it from becoming one.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
