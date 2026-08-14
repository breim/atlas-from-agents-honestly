# Tool Circuit Breaker

**Tier:** micro. One pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Failure Patterns · Tool Circuit Breaker](https://agentshonestly.com/book/patterns/failure/tool-circuit-breaker)

Stop calling the thing that is down, and find out when it comes back without a stampede.

## The task

Implement `run(calls, threshold, cooldownMs)`, returning `{ states, reached }`.

- **Closed.** Calls go through. `threshold` *consecutive* failures opens it.
- **Open.** Every call is short-circuited without touching the tool, for `cooldownMs`
  after it opened.
- **Half-open.** The first call after the cooldown is a probe. It reaches the tool;
  success closes the breaker, failure opens it again for another cooldown.

`states` is the state each call was served in; `reached` lists the arrival times of calls
that actually hit the tool.

`reached` is the assertion that matters. `an-open-breaker-short-circuits-without-calling`
sends two calls that would have succeeded while the breaker is open, and neither appears.
A breaker that calls the tool and then discards the result reports the same states and
provides none of the value. The point is to stop sending traffic to a service that is
already failing, not to hide its answers.

`a-success-resets-the-failure-count` pins *consecutive*. Two failures, a success, two
more failures does not trip a threshold of three. Counting failures cumulatively means
the breaker eventually opens on any tool that has ever had a bad minute.

`a-failed-probe-opens-the-breaker-again` is why half-open admits exactly one call. Letting
the whole backlog through at cooldown expiry is how a recovering service gets knocked
straight back over.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
