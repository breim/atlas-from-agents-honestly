# Identity

**Tier:** build — this is a piece of Atlas. Self-contained, like every exercise here; the
narrative continues in the next build rather than the code.

**Chapter:** [Part XVI · Security · Identity](https://github.com/breim/agents-honestly/blob/main/content/docs/security/identity.mdx)

The token that names both principals, and the four ways a run loses one of them.

## The task

Implement `act(token, action, backends, agentId)`, returning
`{ status, errors, log, scopesUsed }`.

Refuse anything but a delegation naming both `sub` and `act`. Refuse a backend that filters
after reading. Refuse a token that lacks a required scope **or carries one the backend does not
need**. Refuse a run that stored a token rather than a delegation reference, or that holds no
reference at all. Refuse an action past the delegation's expiry, and a scheduled run with no
named human owner. Emit an audit line naming the user, the agent and the run — and refuse if any
of the three is missing.

## The property

`only-delegation-is-ever-allowed` is the three-way choice as one assertion. A service credential
makes the agent a confused deputy: nothing is broken and everything is wrong, because every
backend sees a request that is perfectly authorised for the *agent*. Impersonation fixes the
authorization and destroys the accountability — the backend's log now says the user did
something the user never did. Only delegation gets both, and `sub` plus `act` is what RFC 8693
has been able to express since 2020.

`the-token-carries-exactly-the-scopes-the-backend-needs-no-more-and-no-less` is downscoping on
the way *in*, and the over-broad case is the interesting one. A token that also carries `hr:read`
is refused even though the call only touches orders, because the alternative — read privileged,
filter afterwards — is a display preference. The content was still read, still logged, still put
in front of the model, and the backend's own audit log now disagrees with your policy.
`a-backend-that-filters-after-reading-was-still-read` says the same thing from the backend's
side.

`expiry-is-checked-at-the-moment-of-the-action-not-at-the-start-of-the-run` is where agents break
the request-scoped assumption. A run pauses on Friday and resumes on Monday; if it replays the
rights it captured, a revocation in between silently did not happen. The property checks
`expiry - 1`, `expiry`, `expiry + 1`, and `the-run-holds-a-reference-and-never-a-token` refuses
the storage pattern that makes replaying old rights possible in the first place.

`a-scheduled-run-needs-an-owner-and-an-attended-one-does-not` walks the full truth table. An
agent running with no user present is not exempt from identity; it needs a named human, a
documented grant, and an expiry that forces re-approval.

`every-audit-line-names-the-user-the-agent-and-the-run`, plus
`an-action-missing-any-part-of-the-audit-line-is-refused`, is the operational half. Any two of
the three leave "why was this allowed" unanswerable, so the line is not something the action
produces on success — it is a condition of being allowed at all.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
