# data/

The fixtures both language tracks share. An eval that cannot be pointed at two
implementations of the same spec is measuring the harness rather than the agent, so
nothing here is generated from either track.

Nothing in this directory is required by the exercise suites. `exercises/` is
deterministic and dependency-free; these are for the running Atlas you build alongside
the book.

## `tickets.jsonl`

The twenty-ticket evaluation sample, one object per line. `expected` carries the labels,
in the shape of the triage schema from
[One Call](https://github.com/breim/agents-honestly/blob/main/content/docs/first-agent/one-call.mdx)
minus `reasoning`, which is model output rather than a label.

`answerable_from_ticket_alone` is `false` on all twenty, and that is the finding rather
than an oversight: every ticket needs a document, a row, or an action. A classifier that
scores well here still resolves nothing, which is the ceiling the tool chapters exist to
lift.

Tickets **8818** and **8821** reference an order without naming one — "the invoice that
came through this morning", "the PO we raised last Tuesday". Their expected `order_ids`
is empty. They are the two cases entity extraction is measured against.

## `policies/`

A sample of the corpus, not the corpus. Each file is one chunk with its provenance in
frontmatter, and each exists for a failure mode the book names:

| File | Why it is here |
| --- | --- |
| `returns-v7.md` | The current answer to ticket 8812. Section 7.3.2, chunk `c-8812`. |
| `returns-v4.md` | Superseded, and it *flatly contradicts* v7 on opened packaging. Retrieval that ranks on similarity alone will surface it. |
| `damage-claims-v3.md` | The policy behind ticket 8823, including the authority limit. |
| `freight-and-tiers-v2.md` | Coverage that depends on account state, not on the document. |
| `warranty-v5.md` | Names RB-420, RB-400 and RB-380 in one passage, which is where dense retrieval stops discriminating between part numbers. |
| `partner-note-7.md` | Untrusted text that reached the index through a supplier portal. `trust: external`. |
| `rival-contract-9.md` | Another tenant's document, in the same corpus on purpose. |

`superseded_at` is the field an output guardrail checks. A chunk can be superseded
between the retrieval and the reply.

## `seed.sql`

Warehouse and CRM fixtures. `compose.yaml` mounts it into
`/docker-entrypoint-initdb.d/`, which **only runs against an empty data directory**. An
existing `atlas-pg` volume will not pick up changes to this file; drop the volume or
apply the statements yourself.

Two answers are worth having in front of you, because both are verifiable and both are
easy to get confidently wrong.

**Ticket 8817, tonnage to Iberia.** Q1 2026 is **45.25 t**, Q2 2026 is **43.95 t**, a
decrease of 1.30 t. Three separate traps stand between the question and that number, and
each produces a different plausible answer:

- *the unit* — rows store `net_mass_kg`, the question asks for tonnes;
- *the region mapping* — `Iberia` is not a column value. It is `ES` and `PT` via
  `regions`, and the French shipment `s-7007` is 30 t of temptation;
- *the date range* — `s-7005` falls on the last day of Q1 and `s-7009` on the last day of
  Q2, so an exclusive upper bound loses them. `s-7001` and `s-7010` sit just outside and
  an inclusive one gains them.

A missing tenant filter adds `s-9101` and 50 t belonging to a different customer.

**Ticket 8823, the credit.** Three unusable RB-400 at the invoiced 41,500 cents is
**124,500 cents**, at or below the 500,000-cent authority limit in damage claims 4.2.1,
so it is issued rather than escalated.
