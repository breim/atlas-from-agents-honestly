import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { QueuedTask, schedule as Schedule } from './start.ts';

interface Case {
  id: string;
  queue: QueuedTask[];
  order: string[];
}

const fixture = expected<{ chapter: string; cases: Case[] }>(import.meta.url);
const { schedule } = await loadImpl<{ schedule: typeof Schedule }>(import.meta.url);

const cases: Array<[string, string]> = [
  ['one-tenant-keeps-its-own-order', 'a single tenant is plain FIFO'],
  ['two-tenants-alternate', 'turns alternate between tenants'],
  ['a-noisy-tenant-cannot-starve-a-quiet-one', 'a bulk import does not bury one request'],
  ['turn-order-follows-first-appearance', 'the first tenant to ask is the first served'],
  ['an-exhausted-tenant-is-skipped', 'fairness does not idle a worker'],
  ['three-tenants-cycle', 'the rotation extends to any number of tenants'],
  ['an-empty-queue-schedules-nothing', 'nothing queued is nothing scheduled'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(schedule(entry.queue), entry.order);
  });
}

test('every task is scheduled exactly once', () => {
  for (const entry of fixture.cases) {
    assert.deepEqual(
      [...schedule(entry.queue)].sort(),
      entry.queue.map((item) => item.task).sort(),
      `${entry.id}: a task was dropped or duplicated`,
    );
  }
});

test('each tenant keeps its own submission order', () => {
  for (const entry of fixture.cases) {
    const order = schedule(entry.queue);
    for (const tenant of new Set(entry.queue.map((item) => item.tenant))) {
      const submitted = entry.queue.filter((item) => item.tenant === tenant).map((i) => i.task);
      assert.deepEqual(
        order.filter((task) => submitted.includes(task)),
        submitted,
        `${entry.id}: ${tenant} was reordered against itself`,
      );
    }
  }
});

test('no tenant takes a second turn while another is still waiting', () => {
  for (const entry of fixture.cases) {
    const owner = new Map(entry.queue.map((item) => [item.task, item.tenant]));
    const remaining = new Map<string, number>();
    for (const item of entry.queue) remaining.set(item.tenant, (remaining.get(item.tenant) ?? 0) + 1);

    const servedThisRound = new Set<string>();
    for (const task of schedule(entry.queue)) {
      const tenant = owner.get(task)!;
      if (servedThisRound.has(tenant)) {
        const waiting = [...remaining].filter(([name, left]) => name !== tenant && left > 0);
        assert.equal(waiting.length, 0, `${entry.id}: ${tenant} cut ahead of ${waiting[0]?.[0]}`);
        servedThisRound.clear();
      }
      servedThisRound.add(tenant);
      remaining.set(tenant, remaining.get(tenant)! - 1);
    }
  }
});
