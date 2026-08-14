# Servers, Clients, Transports

**Tier:** drill — a self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part IX · MCP · Servers, Clients, Transports](https://github.com/breim/agents-honestly/blob/main/content/docs/mcp/servers-clients-transports.mdx)

Your MCP server validates tokens. It does not issue them.

## The task

Implement `authorize(token, request, now)`, returning `{ ok: true, subject }` or
`{ ok: false, error }`.

Three checks, in this order: the token has not expired, its audience is the resource being
called, and its scopes include the one the call needs. On success the subject is the
token's.

## The property

`a-token-issued-for-another-server-is-rejected` is the confused deputy, and step ⑤–⑥ of the
auth chain is the step teams skip. The token is real. It is unexpired. It carries
`crm.read`. It was issued for the freight carrier's server, and it is being presented to
Meridian's. Skip the audience check and Meridian accepts a credential it was never given —
which means anyone who can get a user to authenticate against *their* server can turn that
into a call against *yours*. Resource indicators bind the token; the audience check is what
makes the binding mean anything.

`the-requester-comes-from-the-token-not-the-arguments` is the rule that did not change when
the transport did. The model chooses the subject; your code supplies the requester. Over
MCP the requester arrives as a validated token claim instead of a session variable, and that
is the only difference. `an-argument-naming-another-subject-never-changes-the-answer` proves
it holds for every case: `argumentSubject` is prompt text, and prompt text is not identity.

`a-read-scope-does-not-grant-a-write` is Meridian's split, concretely. The sales agent gets
`crm.read`. It does not get `erp.credit`, and a server that treats one token as one
permission has no way to express the difference.

The three checks are ordered rather than combined because an error you cannot act on is an
error you will misread. `expiry-is-reported-before-the-audience` and
`the-audience-is-reported-before-the-scope` fix the diagnosis: refresh the token, or fetch
one for the right server, or ask for a broader grant. Those are three different fixes.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
