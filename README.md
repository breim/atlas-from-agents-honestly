# Atlas

The executable companion to **[Agents, Honestly](https://github.com/breim/agents-honestly)**.

Two things live here:

1. a **deterministic kernel** — the part of Atlas that must stay exact regardless of
   which model or framework sits above it: scope, taint, approvals, idempotency, event
   deduplication, retrieval isolation, and hard bounds;
2. **exercises**, one per chapter that has one, in TypeScript and Python.

Nothing here needs a model key. The fastest tests in an agentic system should run while
the provider is down, so every assertion in this repository is a system property rather
than a sentence from a model.

## Run it

```bash
npm test          # kernel labs + every exercise, graded against your own work
npm run verify    # the same suite against the reference solutions, plus the checker
```

TypeScript needs Node 22.18 or newer, because the test runner strips erasable types
directly and that became the default there. Python needs 3.11 or newer. Neither track
has a dependency.

`.devcontainer/` pins the pair CI runs — Node 24 and Python 3.11 — so a fork opens with
both suites already runnable and nothing installed locally.

The kernel labs also run the way the book documents them:

```bash
cd ts && npm test
cd py && python3.11 -m unittest discover -s tests -v
```

## Exercises

Every exercise mirrors its chapter's slug, so `exercises/foundations/tokens/` belongs to
`/book/foundations/tokens`.

```text
exercises/foundations/tokens/
├── README.md          the brief, and the property the test proves
├── expected.json      the observable contract, shared byte-for-byte by both tracks
├── ts/{start,solution}.ts + exercise.test.ts
└── py/{start,solution}.py + test_exercise.py
```

You edit `start`. `ATLAS_SOLUTIONS=1` grades `solution` instead, which is how CI proves a
reference implementation has not drifted from its own exercise.

The two language tracks are siblings. Neither is generated from the other. They share
fixtures and expected properties, not internal code — Python may use dicts where
TypeScript uses readonly interfaces, and the SDK details differ. The observable contract
is the part that must agree, and `npm run check` fails when it stops agreeing.

### Tiers

| Tier | Count | What it is |
| --- | --- | --- |
| `build` | 38 | Advances the running Atlas system. Later chapters build on it. |
| `drill` | 62 | A self-contained technique. Nothing outside the directory depends on it. |
| `micro` | 66 | One pattern from the catalog, one property, twenty to forty lines. |
| `read` | 48 | No exercise. The chapter is an argument, a survey, or a reference. |

The classification lives in `tiers.json` and is owned by this repository. Chapters that
are conceptual do not get a coded exercise, because filler teaches readers to skip.

## Staying in step with the book

`book.json` is generated. It carries all 214 chapters, their order, their titles, and
which 49 sit on the core path.

```bash
BOOK_PATH=../agents-honestly npm run sync    # regenerate
npm run sync -- --check                      # fail if stale
npm run scaffold -- --only tools/idempotency # create one exercise's eight files
npm run check                                # the consistency gate
```

`sync` fails when a slug in `tiers.json` no longer exists in the book, which is the
failure mode two repositories actually have. `check` fails when an exercise has no
chapter behind it, is missing a file, or has a case that only one language track
asserts.

## Shared fixtures

`data/` holds what both language tracks point at: the twenty-ticket evaluation sample
with its labels, a sample of the policy corpus with provenance in frontmatter, and the
warehouse and CRM seed. None of it is needed to run the exercises, which stay
deterministic and offline. `data/README.md` explains what each file is there to break.

## Optional services

`compose.yaml` starts Postgres with pgvector and applies `data/seed.sql`. A local
Temporal server persists its history to `.temporal/`:

```bash
docker compose up -d
temporal server start-dev --db-filename .temporal/atlas.db
```

Both are optional. The deterministic suite remains the gate after the in-memory adapters
are replaced with Postgres, Temporal Activities, and a real model gateway. A remote
dependency can add coverage. It cannot weaken an invariant.
