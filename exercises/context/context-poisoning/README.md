# Context Poisoning

**Tier:** drill — a self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part III · Context Engineering · Context Poisoning](https://agentshonestly.com/book/context/context-poisoning)

A bad fact in this turn is a bug. A bad fact in durable memory is a bug that recurs.

## The task

Implement `admit(candidate, pinned, trusted)`, returning `{ admitted, reason }`.

A candidate fact enters durable memory only when **every** source it derives from is in
`trusted`, and it does not contradict a pinned value. Refusals are `untrusted_source`
then `contradicts_pinned`, in that order.

`a-fact-with-no-sources-is-refused` sets the default: unattributed is untrusted.
`an-unrecognised-source-marking-is-untrusted` extends it — a marking you cannot name is a
marking you cannot vouch for. Both fail closed, and `one-external-source-among-many-is-still-a-refusal`
is the reason there is no scoring here: a fact assembled from two good sources and one
hostile one is a hostile fact.

Refusal is not rejection of the fact for this turn. The agent may still use it to answer
right now; what it may not do is *believe* it tomorrow. That distinction is the whole
point — a poisoned context lasts one conversation, and a poisoned memory lasts until
someone goes looking.

`a-fact-contradicting-a-pinned-value-is-refused` guards the other direction. A perfectly
well-sourced fact claiming the credit limit is 999999 is refused, because pinned values
are pinned: they change through the process that set them, not through something the
agent read. `restating-a-pinned-value-is-admitted` keeps that from being paranoia — the
check is contradiction, not mere mention.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
