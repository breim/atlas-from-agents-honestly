# The Coordination Tax

**Tier:** drill. A self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part XIX · Multi-Agent · The Coordination Tax](https://agentshonestly.com/book/multi-agent/the-coordination-tax)

Before you buy the topology, check whether you could have bought the tokens.

## The task

Implement `price(topology, baseline, config)`, returning the per-agent ledger, the
multiplier against a stated single-agent baseline, the latency, and whether the tax is
justified.

Each agent runs its own loop: the context at turn *t* is its prefix, plus any inbound
summary, carried forward with the accumulating transcript. The outbound summary is written
once. Serial agents add their spans; parallel agents finish with the slowest. The tax is
worth paying only when the task value covers the cost **and** the work is genuinely parallel
or genuinely must be isolated. A single agent has no tax to justify.

## The property

`two-agents-are-two-quadratics-not-one-halved` is the arithmetic behind the reported 15×.
Both agents carry their own prefix and re-send their own growing transcript, so splitting a
run does not divide the token cost. It multiplies the number of contexts that grow. The
multiplier here is 2.08× for two agents doing the same work.

`an-inbound-summary-is-paid-on-every-turn-of-the-receiver` is the charge people forget. The
sender pays 800 output tokens once; the receiver pays 800 input tokens **eight times**,
because the handoff joined its prefix and the prefix is re-sent every turn. That asymmetry is
why passing references instead of payloads is a real optimisation and not a style preference.

`fan-out-buys-latency-and-changes-no-tokens` is the one refund available, and
`the-token-bill-does-not-depend-on-whether-the-agents-ran-in-parallel` states its limit
exactly. Parallelism halves the wall clock and moves the bill by nothing. Fan-out buys
latency; conversation spends it.

`a-thin-margin-cannot-absorb-the-multiplier` is genuinely parallel work that still fails, and
it is why both conditions are required rather than either. Atlas resolves support tickets at
single-digit-dollar margins: the multiplier exceeds the margin, and no amount of correct
parallelism fixes that.

`isolation-is-a-reason-that-does-not-need-parallelism` is the one Atlas actually pays. A
quarantined reader that must not hold tools is not available to a single agent at any budget,
which is what makes it a real reason rather than a preference.

`a-narrow-worker-cuts-the-multiplier` is the largest lever if you have decided to pay: a
worker that inherits the orchestrator's full catalogue pays for it every turn and gains
nothing. 2.08× down to 1.44×, from one field.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
