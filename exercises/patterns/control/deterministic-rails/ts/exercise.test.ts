import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Handled, Rail, Request, handle as Handle } from './start.ts';

interface Case {
  id: string;
  request: Request;
  result: Handled;
}

const fixture = expected<{ chapter: string; rails: Rail[]; cases: Case[] }>(import.meta.url);
const { handle } = await loadImpl<{ handle: typeof Handle }>(import.meta.url);

/** Counts real invocations, so a discarded model call is still a model call. */
function spy() {
  let calls = 0;
  const model = (request: Request) => {
    calls += 1;
    return `model answer for ${request.intent ?? 'unknown'}`;
  };
  return { model, calls: () => calls };
}

const run = (entry: Case) => {
  const { model, calls } = spy();
  return { handled: handle(entry.request, fixture.rails, model), calls: calls() };
};

const cases: Array<[string, string]> = [
  ['a-railed-request-never-reaches-the-model', 'a known question costs nothing'],
  ['the-first-matching-rail-answers', 'the matching rail supplies the answer'],
  ['an-unrailed-request-falls-through-to-the-model', 'an unknown question reaches the model'],
  ['a-request-with-no-intent-falls-through', 'a missing intent is not a rail match'],
  ['a-rail-answers-identically-every-time', 'a railed answer cannot drift'],
  ['an-intent-that-only-looks-railed-falls-through', 'matching is exact, not by prefix'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry).handled, entry.result);
  });
}

test('a railed answer really does not invoke the model', () => {
  for (const entry of fixture.cases) {
    const { handled, calls } = run(entry);
    if (handled.source !== 'rail') continue;
    assert.equal(calls, 0, `${entry.id}: called the model and threw the answer away`);
  }
});

test('the reported count matches what actually happened', () => {
  for (const entry of fixture.cases) {
    const { handled, calls } = run(entry);
    assert.equal(handled.modelCalls, calls, `${entry.id}: modelCalls is not the real count`);
  }
});

test('a railed answer comes verbatim from its rail', () => {
  for (const entry of fixture.cases) {
    const { handled } = run(entry);
    if (handled.source !== 'rail') continue;
    const rail = fixture.rails.find((candidate) => candidate.when === entry.request.intent)!;
    assert.equal(handled.answer, rail.answer, `${entry.id}: the rail's answer was rewritten`);
  }
});
