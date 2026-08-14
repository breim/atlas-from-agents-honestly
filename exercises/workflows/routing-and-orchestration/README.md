# Routing and Orchestration

**Tier:** drill — a self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part VI · Workflows Before Agents · Routing and Orchestration](https://github.com/breim/agents-honestly/blob/main/content/docs/workflows/routing-and-orchestration.mdx)

The orchestrator owns the failure semantics, so it has to distinguish two kinds of "no".

## The task

Implement `orchestrate(kind, handlers, outcomes)`, returning
`{ status, answeredBy, dispatched, failedBy }`.

Handlers are tried in declaration order, and only those declaring the request kind. A
handler that returns `ok` answers. A handler that **declines** hands on. A handler that
**errors** stops the orchestration. `dispatched` records who was actually called.

`an-error-stops-the-orchestration` is the whole drill. `canned` breaks and `agent` would
have answered perfectly — and the orchestration fails anyway. That feels wrong until you
notice the alternative: treating an error as a decline means a handler that is *down*
gets routed around, every request succeeds, and nothing tells you a component has been
broken for a week. The fallback hid the outage.

A decline is a routing signal, and it is information the handler chose to give you: *this
is not mine*. An error is a fault, and it belongs to whoever owns that handler. Collapsing
them into "didn't work, try the next one" is how a system develops a quiet dependency on
its fallback path.

`a-handler-that-does-not-declare-the-kind-is-never-called` keeps declining cheap.
Capability is declared up front, so an incapable handler costs nothing to skip — it should
not have to be invoked in order to say no.

The three non-answering outcomes are deliberately distinct: `unhandled` (everyone
declined — a real gap in your coverage), `unroutable` (nobody even declares this kind),
and `failed` (something is broken). Each needs a different person to look at it.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
