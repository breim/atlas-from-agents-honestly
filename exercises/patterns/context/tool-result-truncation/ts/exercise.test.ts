import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { truncate as Truncate } from './start.ts';

interface Case {
  id: string;
  text: string;
  budget: number;
  output: string;
}

const fixture = expected<{ chapter: string; marker: string; cases: Case[] }>(import.meta.url);
const { truncate } = await loadImpl<{ truncate: typeof Truncate }>(import.meta.url);

const run = (id: string) => {
  const entry = findCase(fixture, id);
  return { entry, actual: truncate(entry.text, entry.budget, fixture.marker) };
};

const cases: Array<[string, string]> = [
  ['fits', 'a result inside the budget is returned untouched'],
  ['exactly-at-budget', 'a result landing exactly on the budget is not elided'],
  ['elides-the-middle', 'an oversized result keeps its head and its tail'],
  ['odd-budget-favours-the-head', 'an odd remainder gives the extra character to the head'],
  ['budget-leaves-room-for-one-character', 'a budget barely over the marker still keeps a head'],
  ['budget-below-the-marker', 'a budget under the marker returns the marker, cut'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const { entry, actual } = run(id);
    assert.equal(actual, entry.output);
  });
}

test('the output never exceeds the budget', () => {
  for (const entry of fixture.cases) {
    const actual = truncate(entry.text, entry.budget, fixture.marker);
    assert.ok(
      [...actual].length <= entry.budget,
      `${entry.id}: ${[...actual].length} characters exceeds a budget of ${entry.budget}`,
    );
  }
});

test('an elision is always visible', () => {
  for (const entry of fixture.cases) {
    if ([...entry.text].length <= entry.budget) continue;
    const actual = truncate(entry.text, entry.budget, fixture.marker);
    assert.ok(actual.length > 0, `${entry.id}: elided to nothing`);
    assert.ok(
      fixture.marker.startsWith(actual) || actual.includes(fixture.marker),
      `${entry.id}: elided without a marker`,
    );
  }
});
