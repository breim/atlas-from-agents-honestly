# Tool Permission Boundary

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Security Patterns · Tool Permission Boundary](https://agentshonestly.com/book/patterns/security/tool-permission-boundary)

What the agent may call, and what the evidence in its context permits it to do.

## The task

Implement `check(tool, trust, grants, tools)`, returning `{ allowed, reason }`.

Two independent gates, both of which must pass:

1. **The grant** — is this tool in the caller's grant at all? If not, `not_granted`.
2. **The taint ceiling** — a `read` is allowed under any trust level. A `write` requires
   a context whose ceiling is not `external`. Otherwise `taint_ceiling`.

The interesting pair is `a-read-is-allowed-even-under-a-tainted-context` and
`a-write-under-a-tainted-context-is-denied`. Retrieved text that turns out to be hostile
can make the agent *look things up* all day — that is annoying and cheap. What it must
never do is reach an effect. Blocking reads under taint instead is the over-correction
that makes the agent useless the moment any external document enters its context, which
is always.

The ordering of the reason codes matters more than it looks.
`an-ungranted-tool-is-denied-for-the-grant-not-the-taint` fails both gates and must be
reported as `not_granted` — because "the model tried to call a tool it was never given"
is a different incident from "a tainted context tried to write", and the person reading
the log at 3am is triaging one or the other.

An unknown tool is `not_granted` rather than an error: refusing something that does not
exist is the same refusal as refusing something you were not given.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
