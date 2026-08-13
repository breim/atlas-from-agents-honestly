import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Task, order as Order } from './start.ts';

interface Case {
  id: string;
  tasks: Task[];
  order: string[];
}

const fixture = expected<{ chapter: string; cases: Case[] }>(import.meta.url);
const { order } = await loadImpl<{ order: typeof Order }>(import.meta.url);

const cases: Array<[string, string]> = [
  ['one-priority-is-plain-fifo', 'equal priorities keep their line'],
  ['higher-priority-runs-first', 'urgency wins over arrival'],
  ['submission-order-breaks-ties', 'the tie-break is explicit, not the engine default'],
  ['priorities-interleave-correctly', 'three priorities sort into three bands'],
  ['a-late-high-priority-task-still-jumps-the-queue', 'arriving last does not mean running last'],
  ['a-flood-of-high-priority-work-starves-the-rest', 'plain priority does starve, on purpose'],
  ['an-empty-queue-orders-nothing', 'nothing queued is nothing ordered'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(order(entry.tasks), entry.order);
  });
}

test('every task runs exactly once', () => {
  for (const entry of fixture.cases) {
    assert.deepEqual(
      [...order(entry.tasks)].sort(),
      entry.tasks.map((task) => task.task).sort(),
      `${entry.id}: a task was dropped or duplicated`,
    );
  }
});

test('priority never decreases along the order', () => {
  for (const entry of fixture.cases) {
    const priority = new Map(entry.tasks.map((task) => [task.task, task.priority]));
    const ordered = order(entry.tasks);
    for (let i = 1; i < ordered.length; i += 1) {
      assert.ok(
        priority.get(ordered[i - 1])! >= priority.get(ordered[i])!,
        `${entry.id}: ${ordered[i]} outranks ${ordered[i - 1]} but runs later`,
      );
    }
  }
});

test('tasks of equal priority hold their submission order', () => {
  for (const entry of fixture.cases) {
    const ordered = order(entry.tasks);
    for (const level of new Set(entry.tasks.map((task) => task.priority))) {
      const submitted = entry.tasks.filter((t) => t.priority === level).map((t) => t.task);
      assert.deepEqual(
        ordered.filter((task) => submitted.includes(task)),
        submitted,
        `${entry.id}: priority ${level} was reordered against itself`,
      );
    }
  }
});
