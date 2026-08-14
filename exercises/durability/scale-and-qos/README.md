# Scale and Quality of Service

**Tier:** drill. A self-contained technique. Nothing outside this directory depends on it.

**Chapter:** [Part XI · Durability · Scale and Quality of Service](https://agentshonestly.com/book/durability/scale-and-qos)

Priority asks what matters more. Fairness asks who gets a turn.

## The task

Implement `dispatch(tasks, weights)`, returning the task ids in dispatch order.

Drain priority levels strictly, 1 before 2 before 3. Within a level, tenants take turns in
the order they first appear, each taking up to `weights[tenant]` tasks per round in
submission order. A tenant with nothing left is skipped. A tenant with no declared weight
takes one turn.

## The property

`priority-outranks-fairness` is the composition rule, and it is what makes the two features
coherent rather than competing. Priority determines which sub-queue a task enters; fairness
determines dispatch order *within* each priority level. So the enterprise tenant's live-chat
tasks beat the standard tenant's normal tickets, but among the live-chat tasks the
enterprise tenant is served according to its share and not according to its backlog.

`a-bulk-import-cannot-starve-a-quiet-tenant` is the noisy-neighbour failure, arriving through
a queue rather than through a database. Five thousand tickets from one customer, and the
customer behind them waits exactly one turn. The property
`no-tenant-waits-behind-more-than-one-weighted-round-of-the-tenants-ahead-of-it` is that
guarantee stated generally: how long you wait depends on who is ahead of you, never on how
much work they brought. One fairness key removes this, which is a much better deal than the
per-tenant worker pools people build instead.

`an-enterprise-weight-takes-two-turns-to-a-standard-one` is what a weight buys and what it
does not. Two turns per round, not precedence: `deepening-one-tenant-backlog-never-delays-another-tenant-first-task`
still holds for the weighted tenant.

Note what is missing: aging. `every-priority-level-drains-in-order` means a level-5 nightly
reconciliation runs only when nothing above it is waiting, and under sustained level-1 load
it does not run at all. That is not a defect to patch. Strict priority means exactly this, and
building an aging scheme on top quietly defeats the ordering you asked for. If you want
low-priority work to make progress under load, you did not want priority. You wanted
fairness.

## Run it

```bash
npm run test:ts
python3.11 scripts/run-py-tests.py
```

Grade the reference instead of your own work with `ATLAS_SOLUTIONS=1`.
