# Supervisor and Handoff

**Tier:** drill — a self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part XIX · Multi-Agent · Supervisor and Handoff](https://agentshonestly.com/book/multi-agent/supervisor-and-handoff)

The topologies are easy to draw. The interesting difference is how they break.

## The task

Implement `execute(plan, budget)`, returning the step trace, the outcome, who ended it, and
the violations.

A **supervisor** runs every worker over its own input at compression depth 1, then
synthesises — at depth 1 if verification reads sources, depth 2 if it reads conclusions. It
always owns termination. A **handoff** walks the chain from `start`, deepening the
compression by one at each transfer, and stops when an agent declares done — or, if the
chain runs out of agents first, drops the work. Neither may run past `maxSteps`.

## The property

`nobody-owns-done-so-the-budget-does` is the handoff's signature failure. Billing hands to
refunds, refunds hands back to billing, and the loop runs until a budget stops it — six steps
of real tokens producing nothing.

`a-chain-that-ends-with-nobody-drops-the-ticket` is the same missing owner pointing the other
way. Ambiguous ownership at the seams means two agents either both act or neither does; the
loop is the first, and this is the second. Both are invisible in a per-agent view, because
every individual span looks clean. `a-handoff-with-nobody-declaring-done-never-completes`
covers both: with no central owner, "we are done" is a judgement each agent makes
independently, and independently nobody makes it.

`a-handoff-chain-compresses-at-every-hop` is the other one, and it is quieter. Triage read
the ticket. Billing received triage's summary. Refunds — the agent that decides whether money
moves — is at depth 3, three compressions away from what the customer actually wrote, with no
way to discover what was dropped. `a-supervisor-keeps-every-worker-at-the-sources` is the
contrast: fan-out means every worker reads a source directly, so the coordination tax stays a
token multiplier instead of becoming a correctness one.

`a-verifier-reading-conclusions-is-a-second-vote` is the single most valuable structural
addition, stated as a depth. A verifier handed the workers' summaries is one more agent
agreeing with them; a verifier handed the sources is a check. And
`verifying-against-sources-never-adds-a-compression` shows the cost of getting it right is
zero.

`workers-that-talk-have-bought-a-handoff-inside-a-supervisor` and
`overlapping-inputs-are-not-disjoint` are the two rules that keep a supervisor a supervisor.
The moment workers coordinate, you are paying handoff prices inside a fan-out and gaining
nothing.

`a-supervisor-that-does-not-fit-stops-cleanly` is the supervisor's redeeming property. It
fails legibly: one trace with a spine, one place that decided, and a partial result rather
than a loop. Given that agentic failures are usually silent and plausible, a topology whose
failures have an obvious owner is worth a great deal.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
