import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { LoopResult, Turn, runLoop as RunLoop } from './start.ts';

interface Case {
  id: string;
  maxSteps: number;
  script: Turn[];
  result: LoopResult;
}

const fixture = expected<{ chapter: string; tools: Record<string, unknown>; cases: Case[] }>(
  import.meta.url,
);
const { runLoop } = await loadImpl<{ runLoop: typeof RunLoop }>(import.meta.url);

const run = (id: string) => {
  const entry = findCase(fixture, id);
  return { entry, actual: runLoop({ script: entry.script, tools: fixture.tools, maxSteps: entry.maxSteps }) };
};

const cases: Array<[string, string]> = [
  ['answers-without-a-tool', 'a run that answers straight away took one step, not zero'],
  ['one-tool-then-answers', 'one tool call and an answer is two model calls'],
  ['three-tools-then-answers', 'the trace records every dispatch in order'],
  ['unknown-tool-becomes-an-observation', 'an unknown tool is recorded, not thrown'],
  ['never-stops', 'a model that never answers stops at the bound'],
  ['bound-of-one', 'the bound is checked before consuming a turn, not after'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const { entry, actual } = run(id);
    assert.deepEqual(actual, entry.result);
  });
}

test('a bounded run never reports an answer', () => {
  for (const entry of fixture.cases) {
    const { status, answer } = runLoop({
      script: entry.script,
      tools: fixture.tools,
      maxSteps: entry.maxSteps,
    });
    if (status === 'bounded') assert.equal(answer, null, `${entry.id}: bounded run returned an answer`);
  }
});

test('no run ever exceeds its own bound', () => {
  for (const entry of fixture.cases) {
    const actual = runLoop({ script: entry.script, tools: fixture.tools, maxSteps: entry.maxSteps });
    assert.ok(actual.steps <= entry.maxSteps, `${entry.id}: ${actual.steps} steps over ${entry.maxSteps}`);
    assert.ok(actual.trace.length <= entry.maxSteps, `${entry.id}: trace longer than the bound`);
  }
});
