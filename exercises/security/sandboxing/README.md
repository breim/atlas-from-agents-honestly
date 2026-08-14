# Sandboxing and Credential Boundaries

**Tier:** drill — a self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part XVII · Security · Sandboxing and Credential Boundaries](https://agentshonestly.com/book/security/sandboxing)

A sandbox that shares an address space with your secrets is a naming convention.

## The task

Implement `handle(request, scope, policy)` — the broker, running outside the sandbox.

A `secret` request is refused, always, and alerts. An `egress` request is allowed only for a
host on the allowlist, and a denial alerts. An `op` request goes through the same
authorization the tool dispatcher runs: the operation must exist, its class must fit the
scope, and its arguments must be this run's order inside the cap. Allowed output is clipped
at `maxOutputBytes` before it crosses.

## The property

`there-is-no-way-to-ask-for-a-secret` is the whole design, and it is a shape rather than a
check. The sandbox asks for an *operation*, gets a result, and the token is minted and used
outside the boundary — so an escape yields an execution environment with nothing in it. Not
"a scoped token instead of the admin key": a scoped token in the sandbox is a token hostile
code can read, log, and send somewhere, and the premise of the boundary is that the code is
hostile.

`generated-code-cannot-call-what-the-model-could-not` and
`the-broker-never-allows-an-operation-the-dispatcher-would-refuse` are one authorization
path, asserted against a check written independently of the solution. Skip this and a
`run_python` tool with database access becomes a tool that can do anything — a second,
unreviewed tool interface that quietly voids every least-privilege control you built.

`an-operation-outside-the-argument-scope-is-refused` and `the-same-operation-on-this-order-is-served`
are the same class-3 call twice. The class was never the problem; the arguments were.

`the-package-registry-is-denied-at-runtime` is the allowlist entry people leave out.
Installing inside a live sandbox is third-party code execution in the middle of your run, and
it is how a dependency-confusion attack reaches a system that never deploys unreviewed code.
`an-empty-allowlist-denies-everything-including-the-broker` confirms the default is deny
rather than allow-with-exceptions.

`an-egress-or-secret-denial-alerts-and-an-authorization-denial-does-not` is the signal
discipline. A refused tool call is ordinary traffic. A blocked connection to an unexpected
host is what a successful injection looks like from the outside, and it is the
highest-signal detection in this part of the book.

`oversized-output-is-truncated-at-the-boundary` matters because sandbox output becomes a tool
result, which becomes prompt text. Clipping it after it has entered the window is clipping it
after it has been paid for — and at the extreme, an unclipped result is a way to blow the
context on purpose.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
