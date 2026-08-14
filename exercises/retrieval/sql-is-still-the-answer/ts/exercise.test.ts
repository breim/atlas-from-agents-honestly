import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Compiled, Layer, Principal, Rails, Request, compile as Compile } from './start.ts';

interface Case {
  id: string;
  principal: string;
  request: Request;
  result: Compiled;
}

interface Fixture {
  chapter: string;
  layer: Layer;
  rails: Rails;
  principals: Record<string, Principal>;
  cases: Case[];
}

const fixture = expected<Fixture>(import.meta.url);
const { compile } = await loadImpl<{ compile: typeof Compile }>(import.meta.url);

const go = (entry: Case, request = entry.request, principal = fixture.principals[entry.principal]) =>
  compile(request, fixture.layer, fixture.rails, principal);

const PRINCIPALS = Object.values(fixture.principals);

const cases: Array<[string, string]> = [
  ['a-governed-query-names-the-time-column-the-model-never-picked', 'shipped_at, not created_at'],
  ['the-same-question-compiles-the-same-way-for-every-asker', 'metric drift, made impossible'],
  ['a-different-metric-brings-its-own-time-column', 'the definition decides, not the model'],
  ['two-dimensions-group-in-the-order-they-were-asked-for', 'the model picks from what you certified'],
  ['a-row-limit-is-enforced-server-side-not-requested-politely', 'a rail, not a request'],
  ['an-unknown-metric-is-a-refusal-not-a-guess', 'the failure mode you want'],
  ['an-unknown-dimension-is-a-refusal', 'no invented column'],
  ['an-unknown-period-is-a-refusal', 'no invented date range'],
  ['tenancy-is-decided-by-the-compiler-not-the-model', 'the same rule as retrieval'],
  ['raw-sql-from-the-model-is-never-executed', 'shape two, not shape three'],
  ['every-refusal-is-reported-not-just-the-first', 'a full answer about why not'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(go(entry), entry.result);
  });
}

test('a refusal never carries a query, and a compiled query never carries a refusal', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    if (outcome.status === 'refused') {
      assert.equal(outcome.sql, null, `${entry.id}: a refusal produced sql`);
      assert.deepEqual(outcome.params, [], `${entry.id}: a refusal produced params`);
      assert.ok(outcome.refusals.length > 0, `${entry.id}: a refusal explained nothing`);
    } else {
      assert.deepEqual(outcome.refusals, [], `${entry.id}: a compiled query still refused something`);
      assert.ok(typeof outcome.sql === 'string' && outcome.sql.length > 0, entry.id);
    }
  }
});

test('anything the layer does not define is refused rather than guessed at', () => {
  const entry = findCase<Case>(fixture, 'a-governed-query-names-the-time-column-the-model-never-picked');
  const probes: Array<[string, Request]> = [
    ['metric', { ...entry.request, metric: 'gross_margin' }],
    ['dimension', { ...entry.request, dimensions: ['warehouse'] }],
    ['period', { ...entry.request, period: 'last_quarter' }],
  ];
  for (const [what, request] of probes) {
    const outcome = go(entry, request);
    assert.equal(outcome.status, 'refused', `an undefined ${what} was answered anyway`);
    assert.equal(outcome.sql, null, `an undefined ${what} produced sql`);
  }
});

test('every compiled query pins the tenant to the principal, in the first parameter', () => {
  for (const entry of fixture.cases) {
    for (const principal of PRINCIPALS) {
      const outcome = go(entry, entry.request, principal);
      assert.equal(outcome.applied.tenantId, principal.tenantId, `${entry.id}: applied lost the tenant`);
      if (outcome.status !== 'compiled') continue;
      assert.ok(
        (outcome.sql as string).includes('WHERE tenant_id = $1 AND'),
        `${entry.id}: the tenant predicate was not first in the WHERE`,
      );
      assert.equal(outcome.params[0], principal.tenantId, `${entry.id}: the tenant parameter was not the principal`);
    }
  }
});

test('the model cannot move the tenant by asking for one', () => {
  const entry = findCase<Case>(fixture, 'a-governed-query-names-the-time-column-the-model-never-picked');
  for (const name of fixture.rails.reservedFilters) {
    const outcome = go(entry, { ...entry.request, filters: { [name]: 'northwind' } });
    assert.equal(outcome.status, 'refused', `${name} was accepted as a filter`);
    assert.ok(outcome.refusals.some((reason) => reason.includes(name)), `${name} was refused without saying so`);
  }
});

test('the same request compiles identically for every asker but the tenant', () => {
  for (const entry of fixture.cases) {
    const compiled = PRINCIPALS.map((principal) => go(entry, entry.request, principal));
    const shapes = new Set(compiled.map((outcome) => outcome.sql));
    assert.equal(shapes.size, 1, `${entry.id}: the same question produced two different queries`);
    const statuses = new Set(compiled.map((outcome) => outcome.status));
    assert.equal(statuses.size, 1, `${entry.id}: the same question was answerable for one asker and not another`);
    for (const outcome of compiled) {
      assert.deepEqual(outcome.params.slice(1), compiled[0].params.slice(1), `${entry.id}: the range moved`);
    }
  }
});

test('the time column comes from the metric definition, never from the request', () => {
  const entry = findCase<Case>(fixture, 'a-governed-query-names-the-time-column-the-model-never-picked');
  for (const [name, metric] of Object.entries(fixture.layer.metrics)) {
    const outcome = go(entry, { ...entry.request, metric: name });
    assert.equal(outcome.status, 'compiled', `${name} did not compile`);
    const sql = outcome.sql as string;
    assert.ok(sql.includes(`${metric.timeColumn} >= $2`), `${name}: used the wrong time column`);
    assert.ok(sql.includes(`${metric.timeColumn} < $3`), `${name}: used the wrong time column`);
    for (const other of Object.values(fixture.layer.metrics)) {
      if (other.timeColumn === metric.timeColumn) continue;
      assert.ok(!sql.includes(other.timeColumn), `${name}: another metric's time column leaked in`);
    }
  }
});

test('the metric carries its own filters into every query that uses it', () => {
  const entry = findCase<Case>(fixture, 'a-governed-query-names-the-time-column-the-model-never-picked');
  for (const [name, metric] of Object.entries(fixture.layer.metrics)) {
    const sql = go(entry, { ...entry.request, metric: name }).sql as string;
    for (const filter of metric.filters) {
      assert.ok(sql.includes(filter), `${name}: dropped a filter the definition requires`);
    }
  }
});

test('the row limit is always applied and never exceeds the rail', () => {
  const entry = findCase<Case>(fixture, 'a-governed-query-names-the-time-column-the-model-never-picked');
  for (const limit of [1, 10, fixture.rails.maxRowLimit, fixture.rails.maxRowLimit + 1, 5_000_000]) {
    const outcome = go(entry, { ...entry.request, limit });
    const owed = Math.min(limit, fixture.rails.maxRowLimit);
    assert.equal(outcome.applied.rowLimit, owed, `limit ${limit} was not clamped`);
    assert.ok((outcome.sql as string).endsWith(` LIMIT ${owed}`), `limit ${limit} was not in the query`);
  }
  const unasked = go(entry, { ...entry.request, limit: undefined });
  assert.equal(unasked.applied.rowLimit, fixture.rails.maxRowLimit, 'an unasked limit was unbounded');
});

test('the rails hold whatever was asked for, refusal or not', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    assert.equal(outcome.applied.timeoutMs, fixture.rails.timeoutMs, `${entry.id}: the timeout moved`);
    assert.equal(outcome.applied.readOnly, fixture.rails.readOnly, `${entry.id}: read-only moved`);
    assert.ok(outcome.applied.rowLimit <= fixture.rails.maxRowLimit, `${entry.id}: the row limit moved`);
  }
});

test('a compiled query only ever names sql the layer defined', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    if (outcome.status !== 'compiled') continue;
    const metric = fixture.layer.metrics[entry.request.metric];
    assert.ok((outcome.sql as string).includes(`FROM ${metric.from} `), `${entry.id}: queried an undefined table`);
    for (const name of entry.request.dimensions) {
      assert.ok(
        (outcome.sql as string).includes(`${fixture.layer.dimensions[name].sql} AS ${name}`),
        `${entry.id}: ${name} was not the certified expression`,
      );
    }
  }
});

test('grouping follows the dimensions, and disappears when there are none', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    if (outcome.status !== 'compiled') continue;
    const sql = outcome.sql as string;
    if (entry.request.dimensions.length === 0) {
      assert.ok(!sql.includes('GROUP BY'), `${entry.id}: grouped by nothing`);
    } else {
      const positions = entry.request.dimensions.map((_, index) => index + 1).join(', ');
      assert.ok(sql.includes(`GROUP BY ${positions} ORDER BY ${positions}`), `${entry.id}: grouped wrongly`);
    }
  }
});
