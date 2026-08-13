import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Queue, Routing, Task, route as Route } from './start.ts';

interface Case {
  id: string;
  tasks: Task[];
  result: Routing;
}

const fixture = expected<{ chapter: string; queues: Queue[]; cases: Case[] }>(import.meta.url);
const { route } = await loadImpl<{ route: typeof Route }>(import.meta.url);

const run = (entry: Case) => route(entry.tasks, fixture.queues);

const cases: Array<[string, string]> = [
  ['a-task-goes-to-the-first-queue-that-can-serve-it', 'declaration order decides among equals'],
  ['a-specialised-need-picks-the-only-queue-with-it', 'a unique capability routes uniquely'],
  ['every-need-must-be-covered-by-one-queue', 'one queue must cover the whole task'],
  ['needs-spread-across-two-queues-are-unroutable', 'partial coverage is not coverage'],
  ['an-unknown-capability-is-unroutable', 'a need nothing provides is refused up front'],
  ['a-task-with-no-needs-goes-to-the-first-queue', 'no needs is satisfied by anything'],
  ['tasks-keep-their-order-within-a-queue', 'a queue is still a queue'],
  ['an-unroutable-task-does-not-block-the-others', 'one bad task is not a batch failure'],
  ['no-tasks-route-nowhere', 'nothing in, nothing routed'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('every task is routed or refused, exactly once', () => {
  for (const entry of fixture.cases) {
    const { routed, unroutable } = run(entry);
    assert.deepEqual(
      [...Object.values(routed).flat(), ...unroutable].sort(),
      entry.tasks.map((task) => task.task).sort(),
      `${entry.id}: a task was lost or duplicated`,
    );
  }
});

test('every routed task landed on a queue that covers all its needs', () => {
  for (const entry of fixture.cases) {
    for (const [name, ids] of Object.entries(run(entry).routed)) {
      const queue = fixture.queues.find((candidate) => candidate.name === name)!;
      for (const id of ids) {
        const task = entry.tasks.find((candidate) => candidate.task === id)!;
        for (const need of task.needs) {
          assert.ok(queue.provides.includes(need), `${entry.id}: ${name} cannot serve ${need}`);
        }
      }
    }
  }
});

test('nothing refusable was actually servable', () => {
  for (const entry of fixture.cases) {
    for (const id of run(entry).unroutable) {
      const task = entry.tasks.find((candidate) => candidate.task === id)!;
      const servable = fixture.queues.some((queue) =>
        task.needs.every((need) => queue.provides.includes(need)),
      );
      assert.ok(!servable, `${entry.id}: refused ${id}, which a queue could have served`);
    }
  }
});
