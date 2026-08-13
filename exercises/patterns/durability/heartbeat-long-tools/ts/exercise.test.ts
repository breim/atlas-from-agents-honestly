import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Liveness, monitor as Monitor } from './start.ts';

interface Case {
  id: string;
  startedAt: number;
  beats: number[];
  finishedAt: number;
  result: Liveness;
}

const fixture = expected<{ chapter: string; timeout: number; cases: Case[] }>(import.meta.url);
const { monitor } = await loadImpl<{ monitor: typeof Monitor }>(import.meta.url);

const run = (entry: Case) =>
  monitor(entry.startedAt, entry.beats, entry.finishedAt, fixture.timeout);

const cases: Array<[string, string]> = [
  ['steady-heartbeats-keep-the-activity-alive', 'a beating activity is a live activity'],
  ['a-gap-longer-than-the-timeout-is-a-death', 'silence past the timeout is death'],
  ['an-activity-that-never-beats-dies-at-the-timeout', 'starting is not proof of life'],
  ['a-gap-exactly-at-the-timeout-is-still-alive', 'the comparison is strict'],
  ['one-past-the-timeout-is-a-death', 'one unit over is over'],
  ['the-silence-after-the-last-beat-also-counts', 'the final gap is a gap'],
  ['a-long-activity-that-keeps-beating-is-not-declared-dead', 'slow is not dead'],
  ['the-first-fatal-gap-wins', 'the reported time is the first death'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('a live activity reports no time of death, a dead one always does', () => {
  for (const entry of fixture.cases) {
    const { alive, declaredDeadAt } = run(entry);
    if (alive) assert.equal(declaredDeadAt, null, `${entry.id}: alive with a time of death`);
    else assert.equal(typeof declaredDeadAt, 'number', `${entry.id}: dead at no particular time`);
  }
});

test('death is always exactly one timeout after some beat', () => {
  for (const entry of fixture.cases) {
    const { alive, declaredDeadAt } = run(entry);
    if (alive) continue;
    const marks = new Set([entry.startedAt, ...entry.beats].map((at) => at + fixture.timeout));
    assert.ok(marks.has(declaredDeadAt!), `${entry.id}: died at a time nothing explains`);
  }
});

test('survival means no gap ever exceeded the timeout', () => {
  for (const entry of fixture.cases) {
    if (!run(entry).alive) continue;
    const marks = [entry.startedAt, ...entry.beats, entry.finishedAt];
    for (let i = 1; i < marks.length; i += 1) {
      assert.ok(
        marks[i] - marks[i - 1] <= fixture.timeout,
        `${entry.id}: survived a gap of ${marks[i] - marks[i - 1]}`,
      );
    }
  }
});
