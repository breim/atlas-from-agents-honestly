# Risk Tiers

**Tier:** drill — a self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part XII · Human in the Loop · Risk Tiers](https://github.com/breim/agents-honestly/blob/main/content/docs/human-in-the-loop/risk-tiers.mdx)

Every approval you ask for spends attention you will not have for the next one.

## The task

Implement `assess(calls, catalogue, capacity)`, returning
`{ decisions, approvals, affordable }`.

For each call, derive the posture from two axes. **Reversibility** comes from the action: the
tool declares it, and a tool with a `templatedReversibility` uses that instead when the call
is templated. **Blast radius** comes from the arguments: it is how many of the tool's
`radiusThresholds` the call's `scope` reaches, capped at 2.

```
                small     moderate   large
reversible      auto      notify     approve
costly          notify    approve    dual
irreversible    approve   dual       dual
```

`approvals` is what the reviewers are asked for: nothing for `auto` and `notify`, one
decision per `approve`, two per `dual`, times the call count. `affordable` is whether that
fits `capacity`.

## The property

`a-larger-refund-at-the-same-tool-needs-two-people` is why one axis is not enough. Part VIII
classified `issue_credit` as an irreversible write and that classification is correct — but
refunding $5 and refunding $5,000 are not one risk, and the difference lives in the
arguments, not in the catalogue. Risk is the cell where the two axes meet, which is how one
tool spans three tiers.

`gating-every-reply-does-not-fit-the-day` and `redesigning-the-action-fits-the-same-day` are
the same 120 replies, and the pair is the chapter. Gate them all and you ask for 120
decisions against a reviewer who can give 40 considered ones. What you get is not more
safety — it is the eleven-second average, and then it is
[OWASP's T10](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/):
flood the reviewer with benign requests until rubber-stamping is the habit, then insert the
action you actually wanted. The gate you built for safety has become a control that is worse
than no gate, because everyone believes there is oversight.

The resolution is not to lower the tier. It is that a reply assembled from an approved
template is a *different action* from one carrying model-authored prose, and only the second
is unbounded when it is wrong. Same tool, different reversibility, `notify` instead of
`approve` — and the day fits.

`the-model-never-decides` is the other half. The posture is a function of the two axes and
nothing else: not a prompt, not a judgement, and not something that can be argued into
letting this particular refund through.

Note what is deliberately absent: there is no posture between `auto` and `approve` other
than `notify`, and `notify` costs the reviewer nothing they have to stop for. Most systems
implement only the first and third, which forces every judgement into trust-completely or
stop-and-wait. The pressure valve is the row people skip.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
