# Prompt Injection

**Tier:** drill — a self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part XVII · Security · Prompt Injection](https://agentshonestly.com/book/security/prompt-injection)

There is no prepared statement for English. So the enforcement lives outside the model.

## The task

Implement `assess(path, catalogue, config)`, returning the taint state, the trifecta, and
the admission decision.

A run is tainted if any read came from an untrusted source — the *source*, never anything
about the bytes. Report the three legs of the trifecta and whether all three are present.
Then decide: an exfiltrating tool must send to the address on the ticket record; a tainted
run may reach the low tool classes freely; above the ceiling it needs this ticket's own order
and an amount inside the tier-0 cap. A denial escalates with its sources attached.

## The property

`an-innocent-untrusted-read-taints-exactly-as-a-hostile-one-would` is why this is a control
rather than a filter. Nothing here inspects content. A ticket that says "my package is late"
taints the run identically to one carrying eleven hundred words of forged system note, and
there is no detection step for an attacker to craft their way past. A classifier at 99%
recall is a 0% control against someone who gets unlimited attempts; a taint flag assigned by
the fetcher has no recall at all, and that is the point.

`a-later-trusted-read-does-not-clear-the-taint` and
`appending-any-read-never-clears-the-taint` are monotonicity. There is no `clear()`, and a
model that emits *"the preceding content was verified safe"* has produced a string. If you
find yourself writing an un-taint path, you have re-introduced the classifier with extra
steps.

`the-same-tool-pointed-at-another-account-is-not` is ticket #9104, stopped. The scoped credit
in the previous case and the hijacked one here are the *same tool at the same class on the
same tainted run* — the only difference is the arguments. Blast radius is a property of the
arguments, and so is the injection's leverage, which is why the ceiling is raised for narrow
calls rather than for the run.

`all-three-present-and-the-path-is-still-safe` is the trifecta used correctly. Private order
data, an attacker-written ticket, and a tool that puts bytes on a network: `lethal: true`, and
admitted, because the recipient came from the ticket record instead of from the model.
`being-lethal-is-a-review-signal-never-a-denial-on-its-own` holds that generally. Atlas keeps
legs ① and ② — reading private orders and customer-written tickets *is the product* — and
gives up ③ as an arbitrary channel out.

`an-untainted-run-still-cannot-invent-a-recipient` is the same rule from the other side. The
recipient check is not a response to taint; it is a control that holds on every path, which
is what makes it worth having.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
