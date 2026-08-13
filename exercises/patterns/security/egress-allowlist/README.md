# Egress Allowlist

**Tier:** micro — one pattern, one property. Twenty to forty lines is the target.

**Chapter:** [Security Patterns · Egress Allowlist](https://github.com/breim/agents-honestly/blob/main/content/docs/patterns/security/egress-allowlist.mdx)

An agent that can fetch a URL can exfiltrate everything it knows to that URL.

## The task

Implement `allowed(url, allow)`, returning `{ allowed, reason }`.

An entry matches a host **exactly**. An entry written with a leading dot
(`.internal.example`) additionally matches its subdomains — but **not the bare domain**.
Only `https` is permitted. Reasons, checked in order: `unparseable`, `scheme_not_allowed`,
`host_not_allowed`.

Three cases exist because three plausible implementations get them wrong, and each one
turns the allowlist into decoration:

- `a-suffix-lookalike-is-refused` — `evil-api.meridian.example`. A naive
  `host.endsWith(entry)` allows it. The attacker registers the prefix and you have
  allowlisted them.
- `an-attacker-controlled-parent-domain-is-refused` — `api.meridian.example.attacker.net`.
  A `host.includes(entry)` allows it. Now the attacker owns everything after your domain.
- `a-host-in-userinfo-does-not-count` — `https://api.meridian.example@attacker.net/`.
  This parses to host `attacker.net`, and any regex reading the string rather than the
  parsed URL allows it. Parse first, then compare.

The scheme check is not pedantry. An allowlisted host reached over `http` is your data on
the wire in cleartext, to whoever is between you and it.

Fail closed on anything you cannot parse. A URL you do not understand is a URL you cannot
vouch for.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
