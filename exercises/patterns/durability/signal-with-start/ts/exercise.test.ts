import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Delivery, Signal, signalWithStart as SignalWithStart } from './start.ts';

interface Case {
  id: string;
  running: string[];
  signals: Signal[];
  result: Delivery;
}

const fixture = expected<{ chapter: string; cases: Case[] }>(import.meta.url);
const { signalWithStart } = await loadImpl<{ signalWithStart: typeof SignalWithStart }>(
  import.meta.url,
);

const run = (entry: Case) => signalWithStart(entry.running, entry.signals);

const cases: Array<[string, string]> = [
  ['a-signal-to-nothing-starts-a-workflow', 'a cold workflow is started on demand'],
  ['a-signal-to-a-running-workflow-does-not-start-one', 'a live workflow is not restarted'],
  ['two-signals-start-one-workflow', 'the second signal finds the workflow already up'],
  ['distinct-ids-start-distinct-workflows', 'ids are independent'],
  ['no-signal-is-ever-dropped-on-the-start-path', 'the signal that started it still arrives'],
  ['no-signals-start-nothing', 'nothing in, nothing started'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('no workflow is started twice', () => {
  for (const entry of fixture.cases) {
    const { started } = run(entry);
    assert.equal(new Set(started).size, started.length, `${entry.id}: duplicate start`);
  }
});

test('an already-running workflow is never started', () => {
  for (const entry of fixture.cases) {
    for (const id of run(entry).started) {
      assert.ok(!entry.running.includes(id), `${entry.id}: restarted the live workflow ${id}`);
    }
  }
});

test('every signal is delivered, in order', () => {
  for (const entry of fixture.cases) {
    const { workflows } = run(entry);
    const byId = new Map<string, string[]>();
    for (const signal of entry.signals) {
      byId.set(signal.workflowId, [...(byId.get(signal.workflowId) ?? []), signal.payload]);
    }
    assert.deepEqual(workflows, Object.fromEntries(byId), `${entry.id}: a signal was lost`);
  }
});
