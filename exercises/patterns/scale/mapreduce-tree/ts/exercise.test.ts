import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Reduction, reduceTree as ReduceTree } from './start.ts';

interface Case {
  id: string;
  items: string[];
  fanIn: number;
  result: Reduction;
}

const fixture = expected<{ chapter: string; cases: Case[] }>(import.meta.url);
const { reduceTree } = await loadImpl<{ reduceTree: typeof ReduceTree }>(import.meta.url);

const run = (entry: Case) => reduceTree(entry.items, entry.fanIn);

const cases: Array<[string, string]> = [
  ['a-single-item-needs-no-merging', 'one item is already the answer'],
  ['a-full-group-merges-in-one-level', 'a full group collapses in one round'],
  ['an-odd-item-carries-to-the-next-level', 'a lone item carries rather than overfilling a group'],
  ['four-items-balance-into-two-levels', 'a power of the fan-in balances exactly'],
  ['a-wider-fan-in-flattens-the-tree', 'a bigger fan-in means fewer rounds'],
  ['the-tree-deepens-as-the-input-grows', 'more items means more levels, not bigger merges'],
  ['no-items-reduce-to-nothing', 'nothing to reduce is null, not a crash'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('no merge step ever exceeds the fan-in', () => {
  for (const entry of fixture.cases) {
    const { levels } = run(entry);
    let width = entry.items.length;
    for (const level of levels) {
      assert.ok(
        level.length >= Math.ceil(width / entry.fanIn),
        `${entry.id}: a level merged more than ${entry.fanIn} inputs`,
      );
      width = level.length;
    }
  }
});

test('every level is strictly narrower than the one before', () => {
  for (const entry of fixture.cases) {
    const { levels } = run(entry);
    let width = entry.items.length;
    for (const level of levels) {
      assert.ok(level.length < width, `${entry.id}: a level did not make progress`);
      width = level.length;
    }
  }
});

test('the result is the single value the last level holds', () => {
  for (const entry of fixture.cases) {
    const { result, levels } = run(entry);
    if (levels.length === 0) {
      assert.equal(result, entry.items[0] ?? null, `${entry.id}: an untouched input changed`);
      continue;
    }
    assert.equal(levels.at(-1)!.length, 1, `${entry.id}: the tree did not converge`);
    assert.equal(result, levels.at(-1)![0], `${entry.id}: the result is not the tree's root`);
  }
});

test('every original item survives into the result', () => {
  for (const entry of fixture.cases) {
    const { result } = run(entry);
    for (const item of entry.items) {
      assert.ok(result!.includes(item), `${entry.id}: ${item} was lost in the reduce`);
    }
  }
});
