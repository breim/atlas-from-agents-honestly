import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Fired, TimerEvent, runTimer as RunTimer } from './start.ts';

interface Case {
  id: string;
  deadline: number;
  events: TimerEvent[];
  horizon: number;
  result: Fired;
}

const fixture = expected<{ chapter: string; cases: Case[] }>(import.meta.url);
const { runTimer } = await loadImpl<{ runTimer: typeof RunTimer }>(import.meta.url);

const run = (entry: Case) => runTimer(entry.deadline, entry.events, entry.horizon);

const cases: Array<[string, string]> = [
  ['an-unresolved-timer-fires-at-its-deadline', 'an untouched timer breaches on time'],
  ['resolving-before-the-deadline-cancels-the-timer', 'resolving in time cancels the breach'],
  ['extending-moves-the-deadline', 'an extension pushes the breach out'],
  ['an-extension-after-the-timer-fired-is-ignored', 'a late extension cannot un-fire a breach'],
  ['resolving-after-the-timer-fired-does-not-unfire-it', 'a late resolution cannot either'],
  ['the-last-extension-before-the-deadline-wins', 'extensions compose in time order'],
  ['an-extension-can-shorten-the-deadline', 'extend is the name, not the constraint'],
  ['a-deadline-beyond-the-horizon-has-not-fired-yet', 'not yet fired is not cancelled'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('firing reports a time, not firing reports none', () => {
  for (const entry of fixture.cases) {
    const { fired, at } = run(entry);
    if (fired) assert.equal(typeof at, 'number', `${entry.id}: fired without a time`);
    else assert.equal(at, null, `${entry.id}: did not fire but reported a time`);
  }
});

test('the fire time is a deadline the timer actually held', () => {
  for (const entry of fixture.cases) {
    const { fired, at } = run(entry);
    if (!fired) continue;
    const held = new Set([entry.deadline, ...entry.events.map((event) => event.to)]);
    assert.ok(held.has(at!), `${entry.id}: fired at ${at}, which was never a deadline`);
  }
});

test('nothing after the fire time can change the outcome', () => {
  for (const entry of fixture.cases) {
    const outcome = run(entry);
    if (!outcome.fired) continue;
    const before = entry.events.filter((event) => event.at < outcome.at!);
    assert.deepEqual(
      runTimer(entry.deadline, before, entry.horizon),
      outcome,
      `${entry.id}: an event after the breach changed the result`,
    );
  }
});
