import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Pipeline, Stage, run as Run } from './start.ts';

interface Case {
  id: string;
  verdicts: string[];
  result: Pipeline;
}

const fixture = expected<{ chapter: string; stages: Stage[]; cases: Case[] }>(import.meta.url);
const { run } = await loadImpl<{ run: typeof Run }>(import.meta.url);

/** Records every stage actually executed, so running past a settled verdict is visible. */
function spy(verdicts: string[]) {
  const executed: string[] = [];
  return {
    execute: (stage: string) => {
      executed.push(stage);
      return verdicts[executed.length - 1] ?? 'undecided';
    },
    executed: () => executed,
  };
}

const execute = (entry: Case) => {
  const { execute: fn, executed } = spy(entry.verdicts);
  return { pipeline: run(fixture.stages, fn), executed: executed() };
};

const cases: Array<[string, string]> = [
  ['the-free-stage-settles-it', 'a cache hit costs nothing'],
  ['an-undecided-stage-hands-on', 'an undecided stage passes the question along'],
  ['the-pipeline-runs-until-something-settles', 'the pipeline advances while it must'],
  ['the-last-stage-settles-whatever-it-says', 'there is nothing after the last stage'],
  ['a-later-stage-never-runs-once-the-question-is-settled', 'settling stops the pipeline dead'],
  ['settling-late-costs-everything-before-it', 'an early-exit pipeline can lose its bet'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(execute(entry).pipeline, entry.result);
  });
}

test('the stages reported as run are the ones that really ran', () => {
  for (const entry of fixture.cases) {
    const { pipeline, executed } = execute(entry);
    assert.deepEqual(pipeline.ran, executed, `${entry.id}: ran does not match what executed`);
  }
});

test('nothing executes after the question is settled', () => {
  for (const entry of fixture.cases) {
    const { executed } = execute(entry);
    const settledAt = entry.verdicts.indexOf('settled');
    if (settledAt === -1) continue;
    assert.equal(
      executed.length,
      settledAt + 1,
      `${entry.id}: ran ${executed.length} stages having settled at ${settledAt + 1}`,
    );
  }
});

test('spent is the cost of exactly the stages that ran', () => {
  for (const entry of fixture.cases) {
    const { pipeline } = execute(entry);
    const billed = pipeline.ran.reduce(
      (sum, name) => sum + fixture.stages.find((stage) => stage.name === name)!.cost,
      0,
    );
    assert.equal(pipeline.spent, billed, `${entry.id}: the bill does not match the run`);
  }
});

test('the stages run are always a prefix of the pipeline', () => {
  for (const entry of fixture.cases) {
    const { pipeline } = execute(entry);
    assert.deepEqual(
      pipeline.ran,
      fixture.stages.slice(0, pipeline.ran.length).map((stage) => stage.name),
      `${entry.id}: the pipeline ran out of order`,
    );
  }
});
