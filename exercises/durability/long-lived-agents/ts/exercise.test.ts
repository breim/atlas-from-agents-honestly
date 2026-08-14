import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Config, Event, Life, live as LiveFn } from './start.ts';

interface Case { id: string; events: Event[]; config: Config; codeVersion: string; result: Life }
interface Fixture { chapter: string; cases: Case[] }

const fixture = expected<Fixture>(import.meta.url);
const { live } = await loadImpl<{ live: typeof LiveFn }>(import.meta.url);
const go = (entry: Case, events = entry.events, config = entry.config) => live(events, config, entry.codeVersion);

const cases: Array<[string, string]> = [
  ['a-burst-of-messages-produces-one-reply', 'that is how people type'],
  ['a-single-message-still-waits-for-the-window', 'the window is not a batch size'],
  ['nothing-arrives-and-nothing-runs', 'between events nothing runs'],
  ['a-close-event-ends-the-case', 'a defined end'],
  ['an-absolute-deadline-expires-the-case', 'carry the deadline, sleep until it'],
  ['the-history-recycles-with-headroom-before-the-cap', 'recycling at the ceiling is fatal'],
  ['carrying-the-raw-transcript-across-a-recycle-is-warned', 'a reference over a summary'],
  ['a-recycle-mid-burst-drains-what-was-buffered', 'pending signals are lost unless drained'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(go(entry), entry.result);
  });
}

test('a burst becomes one batch, and a gap starts another', () => {
  const entry = findCase<Case>(fixture, 'a-burst-of-messages-produces-one-reply');
  const outcome = go(entry);
  const messages = entry.events.filter((event) => event.kind === 'message');
  assert.ok(outcome.batches.length < messages.length, 'every message got its own reply');
  for (const batch of outcome.batches) {
    for (let index = 1; index < batch.events.length; index += 1) {
      assert.ok(
        batch.events[index] - batch.events[index - 1] < entry.config.quietWindowMs,
        'two events a quiet window apart were batched together',
      );
    }
  }
});

test('every message is acted on exactly once, in order', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    const acted = outcome.batches.flatMap((batch) => batch.events);
    assert.equal(new Set(acted).size, acted.length, `${entry.id}: a message was acted on twice`);
    assert.deepEqual([...acted].sort((a, b) => a - b), acted, `${entry.id}: messages were reordered`);
    const arrived = entry.events
      .filter((event) => event.kind === 'message' && event.at < entry.config.deadlineAt)
      .map((event) => event.at);
    assert.deepEqual(acted, arrived, `${entry.id}: a message was dropped or invented`);
  }
});

test('a batch never fires before its quiet window has elapsed', () => {
  for (const entry of fixture.cases) {
    for (const batch of go(entry).batches) {
      assert.ok(batch.actedAt >= (batch.events.at(-1) as number), `${entry.id}: acted before the last event`);
    }
  }
});

test('a new message restarts the window rather than extending a fixed one', () => {
  const entry = findCase<Case>(fixture, 'a-single-message-still-waits-for-the-window');
  const window = entry.config.quietWindowMs;
  const chatty = [0, window - 1, 2 * (window - 1), 3 * (window - 1)].map((at) => ({
    at,
    kind: 'message' as const,
    bytes: 10,
  }));
  const outcome = go(entry, chatty);
  assert.equal(outcome.batches.length, 1, 'a customer who keeps typing got several replies');
  assert.equal(outcome.batches[0].events.length, chatty.length, 'the batch lost a message');
});

test('a recycle happens with headroom, never at the ceiling', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    for (const recycle of outcome.recycles) {
      assert.ok(
        recycle.eventsBefore <= entry.config.historyEventCap,
        `${entry.id}: recycled past the cap`,
      );
      assert.ok(
        recycle.eventsBefore >= entry.config.historyEventCap - entry.config.headroomEvents,
        `${entry.id}: recycled far too early`,
      );
    }
  }
});

test('a recycle resets the history it was called for', () => {
  const entry = findCase<Case>(fixture, 'the-history-recycles-with-headroom-before-the-cap');
  const outcome = go(entry);
  assert.ok(outcome.recycles.length > 0, 'the fixture no longer recycles');
  assert.ok(outcome.historyEvents < entry.config.historyEventCap, 'the history was never reset');
});

test('a recycle drains the buffer before it crosses the boundary', () => {
  const entry = findCase<Case>(fixture, 'a-recycle-mid-burst-drains-what-was-buffered');
  const outcome = go(entry);
  const drained = outcome.recycles.reduce((total, recycle) => total + recycle.drained, 0);
  assert.ok(drained > 0, 'the fixture no longer recycles mid-burst');
  const acted = outcome.batches.flatMap((batch) => batch.events);
  const arrived = entry.events.filter((event) => event.kind === 'message').map((event) => event.at);
  assert.deepEqual(acted, arrived, 'a pending signal was lost across continue-as-new');
});

test('what crosses the boundary is a choice, and the raw transcript is the warned one', () => {
  const entry = findCase<Case>(fixture, 'the-history-recycles-with-headroom-before-the-cap');
  for (const carry of ['reference', 'summary', 'transcript'] as const) {
    const outcome = go(entry, entry.events, { ...entry.config, carry });
    for (const recycle of outcome.recycles) assert.equal(recycle.carried, carry, `${carry} was not carried`);
    const warned = outcome.warnings.some((warning) => warning.includes('raw transcript'));
    assert.equal(warned, carry === 'transcript', `${carry} was warned about wrongly`);
  }
});

test('the deadline is absolute, so it fires whatever else is happening', () => {
  const entry = findCase<Case>(fixture, 'an-absolute-deadline-expires-the-case');
  const outcome = go(entry);
  assert.equal(outcome.status, 'expired');
  const acted = outcome.batches.flatMap((batch) => batch.events);
  for (const at of acted) assert.ok(at < entry.config.deadlineAt, 'a message past the deadline was acted on');
  const chatty = entry.events.map((event, index) => ({ ...event, at: index * 10 }));
  assert.notEqual(go(entry, chatty).status, 'expired', 'a busy case expired at the same wall clock');
});

test('a case that never closes is warned about, and a closed one is not', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    const warned = outcome.warnings.some((warning) => warning.includes('defined end'));
    assert.equal(warned, outcome.status === 'open' && entry.events.length > 0, `${entry.id}: end warning`);
    if (outcome.status === 'closed') assert.deepEqual(outcome.warnings, [], `${entry.id}: a closed case warned`);
  }
});

test('nothing after a close is ever processed', () => {
  const entry = findCase<Case>(fixture, 'a-close-event-ends-the-case');
  const extended = [...entry.events, { at: 90000, kind: 'message' as const, bytes: 10 }];
  const outcome = go(entry, extended);
  assert.equal(outcome.status, 'closed');
  assert.ok(!outcome.batches.some((batch) => batch.events.includes(90000)), 'a message after close was answered');
});
