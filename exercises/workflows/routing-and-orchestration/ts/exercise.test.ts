import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Handler, Orchestration, orchestrate as Orchestrate } from './start.ts';

interface Case {
  id: string;
  kind: string;
  outcomes: Record<string, string>;
  result: Orchestration;
}

const fixture = expected<{ chapter: string; handlers: Handler[]; cases: Case[] }>(
  import.meta.url,
);
const { orchestrate } = await loadImpl<{ orchestrate: typeof Orchestrate }>(import.meta.url);

const run = (entry: Case) => orchestrate(entry.kind, fixture.handlers, entry.outcomes);

const cases: Array<[string, string]> = [
  ['the-first-capable-handler-answers', 'the cheapest capable handler goes first'],
  ['a-decline-moves-to-the-next-handler', 'a decline is a routing signal'],
  ['an-error-stops-the-orchestration', 'an error is a fault, not a decline'],
  ['a-handler-that-does-not-declare-the-kind-is-never-called', 'capability is declared, not discovered'],
  ['declines-cascade-to-the-last-handler', 'declines chain all the way down'],
  ['everyone-declining-leaves-the-request-unhandled', 'a coverage gap has its own status'],
  ['an-error-late-in-the-chain-still-stops-everything', 'position does not soften a fault'],
  ['a-kind-nobody-declares-is-unroutable', 'nothing capable is its own status'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('nothing incapable of the kind is ever dispatched to', () => {
  for (const entry of fixture.cases) {
    for (const name of run(entry).dispatched) {
      const handler = fixture.handlers.find((candidate) => candidate.name === name)!;
      assert.ok(handler.handles.includes(entry.kind), `${entry.id}: called ${name} for nothing`);
    }
  }
});

test('dispatch follows declaration order without gaps', () => {
  for (const entry of fixture.cases) {
    const capable = fixture.handlers
      .filter((handler) => handler.handles.includes(entry.kind))
      .map((handler) => handler.name);
    const { dispatched } = run(entry);
    assert.deepEqual(dispatched, capable.slice(0, dispatched.length), `${entry.id}: out of order`);
  }
});

test('an error is never routed around', () => {
  for (const entry of fixture.cases) {
    const { dispatched, status, failedBy } = run(entry);
    const broken = dispatched.filter((name) => entry.outcomes[name] === 'error');
    if (broken.length === 0) continue;
    assert.equal(status, 'failed', `${entry.id}: a broken handler was routed around`);
    assert.equal(failedBy, broken[0], `${entry.id}: the wrong handler was blamed`);
    assert.equal(dispatched.at(-1), broken[0], `${entry.id}: kept going after an error`);
  }
});

test('only an answered run names a handler that answered', () => {
  for (const entry of fixture.cases) {
    const { status, answeredBy } = run(entry);
    if (status === 'answered') assert.ok(answeredBy, `${entry.id}: answered by nobody`);
    else assert.equal(answeredBy, null, `${entry.id}: ${status} with an answer`);
  }
});

test('turning any error into a decline changes the outcome', () => {
  for (const entry of fixture.cases) {
    if (run(entry).status !== 'failed') continue;
    const softened = Object.fromEntries(
      Object.entries(entry.outcomes).map(([name, outcome]) => [
        name,
        outcome === 'error' ? 'decline' : outcome,
      ]),
    );
    assert.notEqual(
      orchestrate(entry.kind, fixture.handlers, softened).status,
      'failed',
      `${entry.id}: errors and declines are being treated alike`,
    );
  }
});
