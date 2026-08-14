import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Entitlements, Policy, Request, Response, serve as ServeFn } from './start.ts';

interface Case { id: string; request: Request; entitlements: Entitlements; policy: Policy; result: Response }
interface Fixture { chapter: string; entitlements: Entitlements; policy: Policy; cases: Case[] }

const fixture = expected<Fixture>(import.meta.url);
const { serve } = await loadImpl<{ serve: typeof ServeFn }>(import.meta.url);
const go = (entry: Case, request = entry.request) => serve(request, entry.entitlements, entry.policy);

const cases: Array<[string, string]> = [
  ['the-api-derives-the-workflow-id-from-the-business-identity', 'the requester rule at HTTP'],
  ['starting-work-returns-immediately', 'never hold the request open'],
  ['a-signal-returns-immediately-too', 'four verbs'],
  ['a-cold-load-opens-the-stream-before-it-snapshots', 'stream-first'],
  ['a-list-comes-from-the-read-model-not-the-cluster', 'the cluster is not a database'],
  ['a-workflow-id-from-the-browser-is-refused', 'broken object-level authorization'],
  ['an-unentitled-business-id-is-not-found-rather-than-forbidden', '404, not 403'],
  ['an-anonymous-request-is-not-found', 'no principal, no record'],
  ['a-request-held-open-is-refused', 'the API is not the worker'],
  ['starting-work-on-a-get-is-refused', 'a GET starts nothing'],
  ['credentials-in-a-buffered-stream-are-refused', 'a buffer everyone replays'],
  ['a-polled-query-is-refused', 'load that scales with tabs'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(go(entry), entry.result);
  });
}

test('the workflow id is always derived, never accepted', () => {
  const entry = findCase<Case>(fixture, 'the-api-derives-the-workflow-id-from-the-business-identity');
  const derived = go(entry).workflowId;
  assert.ok(derived?.includes(entry.request.businessId as string), 'the id does not derive from the entity');
  for (const supplied of ['atlas-ticket-9100', 'atlas-ticket-8823', 'anything']) {
    const outcome = go(entry, { ...entry.request, workflowIdFromBrowser: supplied });
    assert.equal(outcome.status, 500, `a supplied id (${supplied}) was accepted`);
    assert.equal(outcome.workflowId, null, 'a refused request still derived an id');
  }
});

test('an entitlement failure is indistinguishable from a missing record', () => {
  const entry = findCase<Case>(fixture, 'the-api-derives-the-workflow-id-from-the-business-identity');
  const unentitled = go(entry, { ...entry.request, businessId: 'ticket-9100' });
  const missing = go(entry, { ...entry.request, businessId: 'ticket-0000' });
  assert.equal(unentitled.status, 404, 'an unentitled request was told it was forbidden');
  assert.deepEqual(unentitled, missing, 'a real record and a missing one gave different answers');
});

test('every principal sees only what it is entitled to', () => {
  const entry = findCase<Case>(fixture, 'the-api-derives-the-workflow-id-from-the-business-identity');
  const everyone = Object.keys(entry.entitlements.entitled);
  const everything = [...new Set(Object.values(entry.entitlements.entitled).flat())];
  for (const principal of everyone) {
    for (const businessId of everything) {
      const outcome = go(entry, { ...entry.request, principal, businessId });
      const owed = entry.entitlements.entitled[principal].includes(businessId);
      assert.equal(outcome.status === 200, owed, `${principal} on ${businessId}`);
    }
  }
});

test('nothing is ever refused with a 403', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    assert.notEqual(outcome.status as number, 403, `${entry.id}: a 403 confirmed a record exists`);
  }
});

test('a refused request derives nothing and reaches nothing', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    if (outcome.status === 200 || outcome.status === 202) continue;
    assert.equal(outcome.workflowId, null, `${entry.id}: a refusal derived an id`);
    assert.equal(outcome.source, null, `${entry.id}: a refusal named a source`);
    assert.deepEqual(outcome.order, [], `${entry.id}: a refusal did work`);
  }
});

test('start and signal return immediately rather than waiting', () => {
  const entry = findCase<Case>(fixture, 'starting-work-returns-immediately');
  for (const verb of ['start', 'signal'] as const) {
    const outcome = go(entry, { ...entry.request, verb, method: 'POST' });
    assert.equal(outcome.status, 202, `${verb} did not return accepted`);
    assert.deepEqual(outcome.order, [verb], `${verb} did more than accept`);
  }
});

test('a cold load opens the stream before it takes a snapshot', () => {
  const entry = findCase<Case>(fixture, 'a-cold-load-opens-the-stream-before-it-snapshots');
  const { order } = go(entry);
  assert.equal(order[0], 'open-stream', 'the snapshot was taken before the stream attached');
  assert.ok(order.indexOf('snapshot') < order.indexOf('render'), 'it rendered before snapshotting');
  assert.equal(order.at(-1), 'reconcile', 'buffered events were never reconciled');
});

test('a list never touches the cluster and a detail view always does', () => {
  const entry = findCase<Case>(fixture, 'a-list-comes-from-the-read-model-not-the-cluster');
  const list = go(entry);
  assert.equal(list.source, 'read-model', 'a list was served from the cluster');
  assert.equal(list.workflowId, null, 'a list derived a workflow id');
  const detail = go(entry, { ...entry.request, verb: 'query' });
  assert.equal(detail.source, 'workflow', 'a detail view was served from a stale projection');
});

test('polling is refused for a query and irrelevant elsewhere', () => {
  const entry = findCase<Case>(fixture, 'the-api-derives-the-workflow-id-from-the-business-identity');
  for (const verb of ['query', 'reconnect', 'list'] as const) {
    const outcome = go(entry, { ...entry.request, verb, polling: true });
    assert.equal(outcome.status === 500, verb === 'query', `polling a ${verb}`);
  }
});

test('the four forbidden behaviours are each refused on their own', () => {
  const entry = findCase<Case>(fixture, 'the-api-derives-the-workflow-id-from-the-business-identity');
  const probes: Array<[string, Partial<Request>]> = [
    ['a supplied workflow id', { workflowIdFromBrowser: 'atlas-x' }],
    ['a held-open request', { holdsRequestOpen: true }],
    ['work started on a GET', { verb: 'start', method: 'GET' }],
    ['credentials in the stream', { credentialsInStream: true }],
  ];
  for (const [name, patch] of probes) {
    const outcome = go(entry, { ...entry.request, ...patch });
    assert.equal(outcome.status, 500, `${name} was accepted`);
    assert.ok(outcome.errors.length > 0, `${name} was refused silently`);
  }
});

test('a start on POST is fine and the same start on GET is not', () => {
  const entry = findCase<Case>(fixture, 'starting-work-returns-immediately');
  assert.equal(go(entry, { ...entry.request, verb: 'start', method: 'POST' }).status, 202);
  assert.equal(go(entry, { ...entry.request, verb: 'start', method: 'GET' }).status, 500);
  assert.equal(go(entry, { ...entry.request, verb: 'query', method: 'GET' }).status, 200, 'a GET query was refused');
});
