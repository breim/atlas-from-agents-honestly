import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Task, dispatch as Dispatch } from './start.ts';

interface Case {
  id: string;
  tasks: Task[];
  result: string[];
}

interface Fixture {
  chapter: string;
  weights: Record<string, number>;
  cases: Case[];
}

const fixture = expected<Fixture>(import.meta.url);
const { dispatch } = await loadImpl<{ dispatch: typeof Dispatch }>(import.meta.url);

const run = (entry: Case) => dispatch(entry.tasks, fixture.weights);
const weightOf = (tenant: string) => fixture.weights[tenant] ?? 1;
const levels = (entry: Case) => [...new Set(entry.tasks.map((task) => task.priority))].sort((a, b) => a - b);
const at = (entry: Case, priority: number) => entry.tasks.filter((task) => task.priority === priority);
const dispatchedAt = (entry: Case, priority: number) => {
  const ids = new Set(at(entry, priority).map((task) => task.id));
  return run(entry).filter((id) => ids.has(id));
};

const cases: Array<[string, string]> = [
  ['one-tenant-at-one-priority-is-plain-fifo', 'nothing to schedule around'],
  ['live-chat-drains-before-the-normal-queue', 'a customer waiting is priority 1'],
  ['every-priority-level-drains-in-order', 'five levels, strictly'],
  ['two-tenants-alternate-within-a-priority', 'each key gets a turn'],
  ['a-bulk-import-cannot-starve-a-quiet-tenant', 'the noisy neighbour, removed in one line'],
  ['an-enterprise-weight-takes-two-turns-to-a-standard-one', 'weight buys share, not precedence'],
  ['priority-outranks-fairness', 'priority picks the sub-queue; fairness orders within it'],
  ['a-tenant-without-a-declared-weight-takes-one-turn', 'the default share is one'],
  ['turn-order-follows-first-appearance', 'the rotation starts where the queue did'],
  ['an-empty-queue-dispatches-nothing', 'no work, no order'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('every task is dispatched exactly once', () => {
  for (const entry of fixture.cases) {
    assert.deepEqual([...run(entry)].sort(), entry.tasks.map((task) => task.id).sort(), entry.id);
  }
});

test('a higher priority always goes before a lower one', () => {
  for (const entry of fixture.cases) {
    const order = run(entry);
    const priority = new Map(entry.tasks.map((task) => [task.id, task.priority]));
    for (let i = 0; i + 1 < order.length; i += 1) {
      assert.ok(
        priority.get(order[i])! <= priority.get(order[i + 1])!,
        `${entry.id}: ${order[i + 1]} outranked ${order[i]} and went second`,
      );
    }
  }
});

test('within one priority, a tenant tasks come out in the order they went in', () => {
  for (const entry of fixture.cases) {
    for (const priority of levels(entry)) {
      const order = dispatchedAt(entry, priority);
      for (const tenant of new Set(at(entry, priority).map((task) => task.tenant))) {
        const submitted = at(entry, priority)
          .filter((task) => task.tenant === tenant)
          .map((task) => task.id);
        assert.deepEqual(
          order.filter((id) => submitted.includes(id)),
          submitted,
          `${entry.id}: ${tenant} was reordered at priority ${priority}`,
        );
      }
    }
  }
});

test('no tenant waits behind more than one weighted round of the tenants ahead of it', () => {
  for (const entry of fixture.cases) {
    for (const priority of levels(entry)) {
      const level = at(entry, priority);
      const turns = [...new Set(level.map((task) => task.tenant))];
      const order = dispatchedAt(entry, priority);
      turns.forEach((tenant, position) => {
        const ahead = turns.slice(0, position).reduce((sum, other) => sum + weightOf(other), 0);
        const first = order.findIndex((id) => level.find((task) => task.id === id)!.tenant === tenant);
        assert.ok(first <= ahead, `${entry.id}: ${tenant} waited behind ${first} tasks, not ${ahead}`);
      });
    }
  }
});

test('the first round of a level hands each tenant exactly its weight', () => {
  for (const entry of fixture.cases) {
    for (const priority of levels(entry)) {
      const level = at(entry, priority);
      const tenantOf = new Map(level.map((task) => [task.id, task.tenant]));
      const turns = [...new Set(level.map((task) => task.tenant))];
      const round = dispatchedAt(entry, priority).slice(
        0,
        turns.reduce((sum, tenant) => sum + weightOf(tenant), 0),
      );
      for (const tenant of turns) {
        const backlog = level.filter((task) => task.tenant === tenant).length;
        if (backlog < weightOf(tenant)) continue;
        const served = round.filter((id) => tenantOf.get(id) === tenant).length;
        assert.equal(served, weightOf(tenant), `${entry.id}: ${tenant} took ${served} of the first round`);
      }
    }
  }
});

test('an explicit weight of one is the same as no weight at all', () => {
  for (const entry of fixture.cases) {
    const declared = { ...fixture.weights };
    for (const task of entry.tasks) declared[task.tenant] ??= 1;
    assert.deepEqual(dispatch(entry.tasks, declared), run(entry), `${entry.id}: the default is not one`);
  }
});

test('deepening one tenant backlog never delays another tenant first task', () => {
  for (const entry of fixture.cases) {
    if (entry.tasks.length === 0) continue;
    const noisy = entry.tasks[0];
    const extra = Array.from({ length: 5 }, (_, index) => ({ ...noisy, id: `${noisy.id}-extra-${index}` }));
    const flooded = dispatch([...entry.tasks, ...extra], fixture.weights);
    const before = run(entry);
    for (const tenant of new Set(entry.tasks.map((task) => task.tenant))) {
      if (tenant === noisy.tenant) continue;
      const first = entry.tasks.find((task) => task.tenant === tenant)!.id;
      assert.ok(
        flooded.indexOf(first) <= before.indexOf(first) + weightOf(noisy.tenant),
        `${entry.id}: flooding ${noisy.tenant} pushed ${tenant} back`,
      );
    }
  }
});
