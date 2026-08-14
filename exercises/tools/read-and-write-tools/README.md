# Read Tools and Write Tools

**Tier:** build — this is a piece of Atlas. Self-contained, like every exercise here; the
narrative continues in the next build rather than the code.

**Chapter:** [Part VIII · Tool Design · Read Tools and Write Tools](https://github.com/breim/agents-honestly/blob/main/content/docs/tools/read-and-write-tools.mdx)

The dispatcher that treats the two kinds of tool as two kinds of thing.

## The task

Implement `dispatch(calls, catalogue, policy)`, returning
`{ order, results, skipped, mislabelled }`.

Dispatch every read (class 1–2, and anything unknown) first, all of them, whatever any other
read did. Then dispatch the writes (class 3+) **one at a time, in order, stopping at the first
failure** — every write behind a failure is skipped, not attempted.

Refuse a write that declares a `filter` argument. Refuse an amount above the tool's `ceiling`.
Mark each result with whether it ran in parallel, whether it may be cached, and whether it may
be retried: freely for a pure read, never for an observed read, and for a write only when the
catalogue declares it idempotent.

Separately, audit the catalogue: any tool whose name starts with a read prefix but whose class
is 2 or above is wearing a disguise.

## The property

`a-write-that-fails-stops-the-writes-behind-it` is the reason writes are serial. The credit is
declined, and the escalation and the customer email behind it are never attempted. Run those
three concurrently instead and a failure in the middle leaves a state that no `tool_result`
describes and no retry can safely resolve — you have sent the customer an email about a credit
that did not happen. `after-a-write-fails-no-later-write-is-attempted` derives the skipped list
from the call order rather than trusting it.

`a-read-that-fails-does-not-stop-the-other-reads` is the same shape with the opposite answer,
and the pair is the chapter in two cases: a wrong read costs a turn, a wrong write costs an
incident.

`only-a-pure-read-is-cacheable-and-freely-retriable` walks one call of each class and checks the
three flags every retry policy, checkpointer and replay mechanism silently depends on. The row
that matters is class 2: `query_warehouse` and `resolve_ticket_status` are *reads* that are not
safe to repeat, because one burns quota and the other starts an SLA clock. Every piece of
safe-repetition machinery adopted in Part VII was bought on the assumption that most tools are
reads — usually true, never automatically true. `escalate_to_human` is the other direction: a
class-3 write that *is* retriable, because the catalogue declares it idempotent.

`a-catalogue-names-its-disguises-whether-or-not-anything-is-called` is the audit, and it runs on
a case with **no calls at all** — because the class is a property of the handler, not of the
name, and not of what anyone happened to invoke. `resolve_ticket_status` reads like a lookup and
starts a clock; `get_or_create_customer` says "get" and creates a row. Both arrive most often
from wrapping an endpoint one-to-one, because `GET` handlers with side effects are common and
nobody minded until the caller became a model with a retry policy.
`the-audit-is-a-property-of-the-catalogue-not-of-the-calls` pins that.

`a-write-that-takes-a-filter-is-refused` is the incident category in one rule. A filter is a
program, and one matching more rows than its author pictured is how bulk operations go wrong.
`an-amount-over-the-ceiling-is-refused-by-the-handler` puts the bound where it is enforced
rather than where it is described, and the property version checks `ceiling - 1`, `ceiling`, and
`ceiling + 1` so the comparison cannot be off by one.

`a-tool-that-is-not-in-the-catalogue-is-refused-without-blocking-anything` keeps an unknown name
from being treated as a failed write and stopping legitimate work behind it.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
