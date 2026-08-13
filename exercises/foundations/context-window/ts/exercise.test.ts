import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Plan, Section, plan as PlanFn } from './start.ts';

interface Case {
  id: string;
  sections: Section[];
  maxOutput: number;
  result: Plan;
}

const fixture = expected<{ chapter: string; windowTokens: number; cases: Case[] }>(
  import.meta.url,
);
const { plan } = await loadImpl<{ plan: typeof PlanFn }>(import.meta.url);

const run = (entry: Case) => plan(entry.sections, entry.maxOutput, fixture.windowTokens);

const cases: Array<[string, string]> = [
  ['a-small-request-leaves-headroom', 'an ordinary request has room to spare'],
  ['the-output-reservation-counts-against-the-window', 'input fitting is not the request fitting'],
  ['input-alone-fitting-is-not-fitting', 'the window holds both halves'],
  ['exactly-filling-the-window-fits', 'landing exactly on the window is allowed'],
  ['one-token-over-does-not-fit', 'one token past the window is a rejection'],
  ['an-oversized-output-reservation-alone-can-break-it', 'a tiny prompt can still be too big'],
  ['an-empty-request-still-reserves-its-output', 'the reservation exists with no prompt at all'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('input is the sum of the sections', () => {
  for (const entry of fixture.cases) {
    assert.equal(
      run(entry).input,
      entry.sections.reduce((sum, section) => sum + section.tokens, 0),
      `${entry.id}: a section went uncounted`,
    );
  }
});

test('the three quantities always account for the whole window', () => {
  for (const entry of fixture.cases) {
    const { input, reserved, headroom } = run(entry);
    assert.equal(
      input + reserved + headroom,
      fixture.windowTokens,
      `${entry.id}: the window does not add up`,
    );
  }
});

test('fits and overBy always agree with headroom', () => {
  for (const entry of fixture.cases) {
    const { headroom, fits, overBy } = run(entry);
    assert.equal(fits, headroom >= 0, `${entry.id}: fits disagrees with headroom`);
    assert.equal(overBy, Math.max(0, -headroom), `${entry.id}: overBy disagrees with headroom`);
  }
});

test('reserving more output never makes a request fit', () => {
  for (const entry of fixture.cases) {
    if (!run(entry).fits) continue;
    const greedy = plan(entry.sections, entry.maxOutput + 1, fixture.windowTokens);
    assert.ok(greedy.headroom < run(entry).headroom, `${entry.id}: a bigger reservation was free`);
  }
});
