import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Request, Routing, route as Route } from './start.ts';

interface Case {
  id: string;
  requests: Request[];
  result: Routing;
}

const fixture = expected<{
  chapter: string;
  now: number;
  batchLatencyMs: number;
  cases: Case[];
}>(import.meta.url);
const { route } = await loadImpl<{ route: typeof Route }>(import.meta.url);

const run = (entry: Case) => route(entry.requests, fixture.now, fixture.batchLatencyMs);

const cases: Array<[string, string]> = [
  ['a-distant-deadline-goes-to-batch', 'time to spare buys the cheap lane'],
  ['a-deadline-inside-the-batch-window-goes-sync', 'a waiting user pays for speed'],
  ['a-deadline-exactly-at-the-turnaround-goes-to-batch', 'exactly enough time is enough'],
  ['one-millisecond-inside-the-turnaround-goes-sync', 'one millisecond short is short'],
  ['a-request-with-no-deadline-is-batchable', 'nobody waiting means nothing to miss'],
  ['an-already-missed-deadline-goes-sync', 'late is not a reason to be later'],
  ['a-mixed-queue-splits-and-keeps-its-order', 'both lanes preserve submission order'],
  ['an-empty-queue-routes-nothing', 'nothing queued is nothing routed'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('every request lands in exactly one lane', () => {
  for (const entry of fixture.cases) {
    const { batch, sync } = run(entry);
    assert.deepEqual(
      [...batch, ...sync].sort(),
      entry.requests.map((request) => request.id).sort(),
      `${entry.id}: a request was lost or duplicated`,
    );
  }
});

test('nothing batched could miss its deadline', () => {
  for (const entry of fixture.cases) {
    for (const id of run(entry).batch) {
      const { deadline } = entry.requests.find((request) => request.id === id)!;
      if (deadline === null) continue;
      assert.ok(
        fixture.now + fixture.batchLatencyMs <= deadline,
        `${entry.id}: batched ${id}, which cannot make its deadline`,
      );
    }
  }
});

test('a longer batch turnaround never batches more', () => {
  for (const entry of fixture.cases) {
    const slower = route(entry.requests, fixture.now, fixture.batchLatencyMs * 2);
    assert.ok(
      slower.batch.length <= run(entry).batch.length,
      `${entry.id}: a slower batch lane took more work`,
    );
  }
});

test('each lane keeps the queue order', () => {
  for (const entry of fixture.cases) {
    const { batch, sync } = run(entry);
    const order = entry.requests.map((request) => request.id);
    for (const lane of [batch, sync]) {
      assert.deepEqual(order.filter((id) => lane.includes(id)), lane, `${entry.id}: reordered`);
    }
  }
});
