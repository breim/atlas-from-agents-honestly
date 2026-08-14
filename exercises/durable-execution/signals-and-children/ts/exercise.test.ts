import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Mailbox, Message, apply as Apply } from './start.ts';

interface Case {
  id: string;
  messages: Message[];
  result: Mailbox;
}

const fixture = expected<{ chapter: string; limit: number; cases: Case[] }>(import.meta.url);
const { apply } = await loadImpl<{ apply: typeof Apply }>(import.meta.url);

const run = (messages: Message[]) => apply(messages, fixture.limit);

const cases: Array<[string, string]> = [
  ['signal-with-start-creates-the-run-it-needs', 'the entity id is the workflow id'],
  ['a-second-signal-with-start-finds-the-existing-run', 'no second run, no race, no lookup table'],
  ['nothing-reaches-a-workflow-that-was-never-started', 'a cold entity has no mailbox'],
  ['a-query-adds-nothing-to-the-history', 'refreshing the console is free'],
  ['an-update-tells-the-caller-what-happened', 'the person who clicked Approve is told'],
  ['a-rejected-update-is-never-recorded', 'the validator fires before anything is written'],
  ['an-update-out-of-phase-is-rejected-by-the-validator', 'approving twice is not a thing'],
  ['a-signal-is-accepted-whether-or-not-it-did-anything', 'accepted is not acted on'],
  ['an-escalated-run-refuses-the-approval-it-was-waiting-for', 'three days is three days'],
  ['an-empty-mailbox-leaves-a-cold-workflow-cold', 'nothing in, nothing out'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(run(entry.messages), entry.result);
  });
}

test('one response per message, always', () => {
  for (const entry of fixture.cases) {
    assert.equal(run(entry.messages).responses.length, entry.messages.length, entry.id);
  }
});

test('dropping every query changes neither the history nor the state', () => {
  for (const entry of fixture.cases) {
    const withQueries = run(entry.messages);
    const without = run(entry.messages.filter((message) => message.kind !== 'query'));
    assert.deepEqual(without.history, withQueries.history, `${entry.id}: a query was written down`);
    assert.deepEqual(without.state, withQueries.state, `${entry.id}: a query changed the workflow`);
  }
});

test('a query answers with the phase the workflow is actually in', () => {
  for (const entry of fixture.cases) {
    const { responses } = run(entry.messages);
    entry.messages.forEach((message, index) => {
      if (message.kind !== 'query' || !responses[index].ok) return;
      const upTo = run(entry.messages.slice(0, index + 1));
      assert.equal(responses[index].value, upTo.state.phase, `${entry.id}: the getter lied`);
    });
  }
});

test('a message that was refused leaves no trace', () => {
  for (const entry of fixture.cases) {
    for (let index = 0; index < entry.messages.length; index += 1) {
      const before = run(entry.messages.slice(0, index));
      const after = run(entry.messages.slice(0, index + 1));
      if (after.responses[index].ok) continue;
      assert.deepEqual(after.history, before.history, `${entry.id}: a refusal was recorded`);
      assert.deepEqual(after.state, before.state, `${entry.id}: a refusal changed the workflow`);
    }
  }
});

test('a signal never reports an outcome, only that it was taken', () => {
  for (const entry of fixture.cases) {
    const { responses } = run(entry.messages);
    entry.messages.forEach((message, index) => {
      if (message.kind === 'query' || message.kind === 'update') return;
      assert.ok(!('value' in responses[index]), `${entry.id}: a signal told the caller what happened`);
    });
  }
});

test('an accepted update always reports the outcome', () => {
  for (const entry of fixture.cases) {
    const { responses } = run(entry.messages);
    entry.messages.forEach((message, index) => {
      if (message.kind !== 'update' || !responses[index].ok) return;
      const upTo = run(entry.messages.slice(0, index + 1));
      assert.equal(responses[index].value, upTo.state.phase, `${entry.id}: the caller learned nothing`);
    });
  }
});

test('an accepted update never took more than the limit', () => {
  for (const entry of fixture.cases) {
    const { responses, state } = run(entry.messages);
    entry.messages.forEach((message, index) => {
      if (message.kind !== 'update' || !responses[index].ok) return;
      assert.ok(message.amountCents! <= fixture.limit, `${entry.id}: the validator let it through`);
    });
    if (state.approvedCents !== null) assert.ok(state.approvedCents <= fixture.limit, entry.id);
  }
});

test('the history only ever grows, one message at a time', () => {
  for (const entry of fixture.cases) {
    for (let index = 0; index < entry.messages.length; index += 1) {
      const before = run(entry.messages.slice(0, index)).history;
      const after = run(entry.messages.slice(0, index + 1)).history;
      assert.deepEqual(after.slice(0, before.length), before, `${entry.id}: history was rewritten`);
      assert.ok(after.length - before.length <= 2, `${entry.id}: one message wrote too much`);
    }
  }
});

test('a run is only ever started once', () => {
  for (const entry of fixture.cases) {
    const starts = run(entry.messages).history.filter((event) => event === 'started');
    assert.ok(starts.length <= 1, `${entry.id}: a duplicate event opened a second run`);
  }
});
