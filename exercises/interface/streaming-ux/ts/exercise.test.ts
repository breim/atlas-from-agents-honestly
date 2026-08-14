import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Action, Stream, serve as Serve } from './start.ts';

interface Case {
  id: string;
  timeline: Action[];
  result: Stream;
}

interface Fixture {
  chapter: string;
  abandonAfterMinutes: number;
  cases: Case[];
}

const fixture = expected<Fixture>(import.meta.url);
const { serve } = await loadImpl<{ serve: typeof Serve }>(import.meta.url);

const run = (timeline: Action[]) => serve(timeline, fixture.abandonAfterMinutes);
const emitted = (timeline: Action[]) =>
  timeline.flatMap((action) => (action.kind === 'emit' ? [action.text] : []));

const cases: Array<[string, string]> = [
  ['a-new-client-gets-the-stream-from-the-beginning', 'nothing missed on a first attach'],
  ['a-refresh-resumes-where-it-left-off', 'no hole, no duplicate'],
  ['a-disconnect-does-not-stop-the-run', 'a closed tab means nothing'],
  ['a-second-device-attaches-from-zero', 'one run, two views'],
  ['an-explicit-stop-ends-the-run', 'a real decision propagates'],
  ['a-client-can-still-read-a-finished-run', 'the buffer outlives the run'],
  ['nobody-returning-abandons-the-run-on-a-policy', 'decided in advance, not inferred'],
  ['a-watched-run-never-goes-idle', 'somebody is still reading'],
  ['coming-back-resets-the-abandon-clock', 'returning is not abandoning'],
  ['resuming-past-the-end-delivers-nothing', 'caught up is caught up'],
  ['an-empty-timeline-has-nothing-to-serve', 'no run, no stream'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(run(entry.timeline), entry.result);
  });
}

test('a refresh never starts a second run', () => {
  for (const entry of fixture.cases) {
    const { buffer } = run(entry.timeline);
    const texts = emitted(entry.timeline);
    assert.deepEqual(buffer.map((event) => event.text), texts.slice(0, buffer.length), entry.id);
  }
});

test('event ids run from one, in order, with no gaps', () => {
  for (const entry of fixture.cases) {
    const { buffer } = run(entry.timeline);
    assert.deepEqual(buffer.map((event) => event.id), buffer.map((_, index) => index + 1), entry.id);
  }
});

test('a delivery is exactly what the buffer held past the last event the client saw', () => {
  for (const entry of fixture.cases) {
    const { deliveries } = run(entry.timeline);
    let served = 0;
    entry.timeline.forEach((action, index) => {
      if (action.kind !== 'connect') return;
      const upTo = run(entry.timeline.slice(0, index + 1));
      const since = action.lastEventId ?? 0;
      const owed = upTo.buffer.filter((event) => event.id > since).map((event) => event.id);
      assert.deepEqual(deliveries[served], { client: action.client, events: owed }, entry.id);
      served += 1;
    });
    assert.equal(deliveries.length, served, `${entry.id}: a delivery came from nowhere`);
  }
});

test('a client never sees the same event twice, and never skips one', () => {
  for (const entry of fixture.cases) {
    const seen = new Map<string, number>();
    for (const delivery of run(entry.timeline).deliveries) {
      for (const id of delivery.events) {
        const previous = seen.get(delivery.client) ?? 0;
        assert.ok(id > previous, `${entry.id}: ${delivery.client} received ${id} after ${previous}`);
        seen.set(delivery.client, id);
      }
    }
  }
});

test('a run is never cancelled without someone saying stop', () => {
  for (const entry of fixture.cases) {
    if (entry.timeline.some((action) => action.kind === 'stop')) continue;
    assert.notEqual(run(entry.timeline).status, 'cancelled', `${entry.id}: intent was inferred`);
  }
});

test('saying stop cancels a run that was still going', () => {
  for (const entry of fixture.cases) {
    if (run(entry.timeline).status !== 'running') continue;
    const stopped = run([...entry.timeline, { kind: 'stop' }]);
    assert.equal(stopped.status, 'cancelled', `${entry.id}: the stop button did nothing`);
  }
});

test('a run that has ended emits nothing more', () => {
  for (const entry of fixture.cases) {
    const before = run(entry.timeline);
    if (before.status === 'running') continue;
    const after = run([...entry.timeline, { kind: 'emit', text: 'after the end' }]);
    assert.deepEqual(after.buffer, before.buffer, `${entry.id}: cancellation did not propagate`);
  }
});

test('one more client changes nothing anyone else already received', () => {
  for (const entry of fixture.cases) {
    const before = run(entry.timeline);
    const after = run([...entry.timeline, { kind: 'connect', client: 'late', lastEventId: null }]);
    assert.deepEqual(after.deliveries.slice(0, before.deliveries.length), before.deliveries, entry.id);
    assert.deepEqual(after.buffer, before.buffer, `${entry.id}: attaching a viewer moved the run`);
  }
});
