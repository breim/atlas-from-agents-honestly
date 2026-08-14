import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Config, Event, Rendered, render as Render } from './start.ts';

interface Case {
  id: string;
  events: Event[];
  result: Rendered;
}

const fixture = expected<{ chapter: string; config: Config; cases: Case[] }>(import.meta.url);
const { render } = await loadImpl<{ render: typeof Render }>(import.meta.url);

const run = (events: Event[], config = fixture.config) => render(events, config);
const results = new Set([...Object.values(fixture.config.registry).map((e) => e.component), fixture.config.fallback]);

const cases: Array<[string, string]> = [
  ['every-state-of-a-tool-call-is-a-frame', 'a tool call is a state machine'],
  ['a-slow-call-grows-a-spinner', 'the spinner earns its place after two seconds'],
  ['an-unregistered-tool-still-renders-something', 'never a blank space'],
  ['an-error-is-a-state-not-a-stack-trace', 'a failure is a frame too'],
  ['the-driver-approves-inline', 'they are already looking at it'],
  ['someone-else-approves-from-a-queue', 'the driver cannot approve their own action'],
  ['approving-shows-submitted-before-accepted', 'a validator may still reject it'],
  ['a-rejected-approval-still-shows-its-card', 'a rejection is an outcome, not a disappearance'],
  ['the-receipt-appears-only-after-the-credit-does', 'anything you show, you have said'],
  ['a-call-with-no-events-renders-nothing', 'no call, no frames'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(run(entry.events), entry.result);
  });
}

test('one frame per event, in order', () => {
  for (const entry of fixture.cases) {
    assert.deepEqual(run(entry.events).frames.map((f) => f.state), entry.events.map((e) => e.kind), entry.id);
  }
});

test('no frame is ever blank', () => {
  for (const entry of fixture.cases) {
    for (const frame of run(entry.events).frames) {
      assert.ok(frame.component.length > 0, `${entry.id}: ${frame.state} rendered nothing`);
    }
  }
});

test('a result component only ever appears on the frame that has the result', () => {
  for (const entry of fixture.cases) {
    for (const frame of run(entry.events).frames) {
      if (!results.has(frame.component)) continue;
      assert.equal(frame.state, 'output_available', `${entry.id}: ${frame.component} was rendered optimistically`);
    }
  }
});

test('every result gets a component, registered or not', () => {
  for (const entry of fixture.cases) {
    const frames = run(entry.events).frames;
    entry.events.forEach((event, index) => {
      if (event.kind !== 'output_available') return;
      const registered = fixture.config.registry[event.tool!]?.component;
      assert.equal(frames[index].component, registered ?? fixture.config.fallback, entry.id);
    });
  }
});

test('the spinner is on exactly when the call has run past the threshold', () => {
  for (const entry of fixture.cases) {
    const frames = run(entry.events).frames;
    entry.events.forEach((event, index) => {
      const slow = (event.elapsedMs ?? 0) >= fixture.config.spinnerAfterMs;
      assert.equal(frames[index].spinner, slow, `${entry.id}: the spinner disagrees at ${event.kind}`);
    });
  }
});

test('the gate goes inline exactly when the approver is driving', () => {
  for (const entry of fixture.cases) {
    const gate = entry.events.find((event) => event.kind === 'gate');
    const { card } = run(entry.events);
    if (!gate) {
      assert.equal(card, null, `${entry.id}: a card appeared without a gate`);
      continue;
    }
    assert.equal(card!.placement, gate.approver === fixture.config.driver ? 'inline' : 'queue', entry.id);
  }
});

test('the card is rendered once, and every surface shows those bytes', () => {
  for (const entry of fixture.cases) {
    const { frames, card } = run(entry.events);
    if (!card) continue;
    assert.equal(frames[card.frame].state, 'gate', `${entry.id}: the card was not minted at the gate`);
    for (const frame of frames) {
      if (frame.component !== 'ApprovalCard') continue;
      assert.equal(frame.detail, card.subject, `${entry.id}: a surface showed a different card`);
    }
  }
});

test('an approval card never disappears once it has been shown', () => {
  for (const entry of fixture.cases) {
    const { frames, card } = run(entry.events);
    if (!card) continue;
    for (const frame of frames.slice(card.frame)) {
      if (frame.state === 'output_available') continue;
      assert.equal(frame.component, 'ApprovalCard', `${entry.id}: ${frame.state} replaced the card`);
    }
  }
});

test('who is driving changes the placement and nothing else', () => {
  for (const entry of fixture.cases) {
    const elsewhere = { ...fixture.config, driver: 'somebody-else' };
    assert.deepEqual(run(entry.events, elsewhere).frames, run(entry.events).frames, entry.id);
  }
});
