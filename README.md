# Atlas companion labs

This directory is the executable companion to Part XX. It begins with a small deterministic kernel so the failure labs run without a model key, Docker, or network access. The kernel is not a fake agent. It is the part of Atlas that must remain exact regardless of which model or framework sits above it: scope, taint, approvals, idempotency, event deduplication, retrieval isolation, and hard bounds.

Both language tracks read the same fixtures from `shared/cases.json` and assert the same invariants.

## Run the no-key labs

TypeScript requires Node 22.6 or newer because the test runner strips erasable TypeScript types directly.

```bash
cd labs/atlas/ts
npm test
```

Python requires 3.11 or newer.

```bash
cd labs/atlas/py
python -m unittest discover -s tests -v
```

## Optional services

`compose.yaml` starts Postgres with pgvector and applies `shared/seed.sql`.

```bash
cd labs/atlas
docker compose up -d
temporal server start-dev --db-filename .temporal/atlas.db
```

The deterministic labs remain the gate even after replacing the in-memory adapters with Postgres, Temporal Activities, and a real model gateway. A remote dependency can add coverage. It cannot weaken an invariant.

## Layout

```text
labs/atlas/
├── compose.yaml
├── shared/
│   ├── cases.json
│   └── seed.sql
├── ts/
│   ├── package.json
│   └── src/
│       ├── core.ts
│       └── labs.test.ts
└── py/
    ├── pyproject.toml
    ├── atlas/
    │   ├── __init__.py
    │   └── core.py
    └── tests/
        └── test_labs.py
```

Each test name matches a lab in the book:

- effect succeeds and the response is lost;
- webhook arrives twice;
- retrieval attempts to cross a tenant;
- hostile retrieval taints a write path;
- approval expires while the workflow waits;
- an agent loop reaches its hard bound.

The expected outcome is always a system property, never a sentence from a model.
