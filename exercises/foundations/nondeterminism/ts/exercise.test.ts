import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Analysis, analyse as Analyse } from './start.ts';

interface Case {
  id: string;
  samples: string[];
  result: Analysis;
}

const fixture = expected<{ chapter: string; consensusBps: number; cases: Case[] }>(
  import.meta.url,
);
const { analyse } = await loadImpl<{ analyse: typeof Analyse }>(import.meta.url);

const run = (entry: Case) => analyse(entry.samples, fixture.consensusBps);

const cases: Array<[string, string]> = [
  ['identical-samples-are-stable', 'a model that never varies scores full agreement'],
  ['a-bare-majority-is-not-consensus', 'three out of five is not agreement'],
  ['a-supermajority-is-stable', 'exactly on the bar counts as stable'],
  ['agreement-is-rounded-not-truncated', 'two thirds rounds up, it does not truncate'],
  ['a-tie-resolves-lexicographically', 'a tie does not make the report random'],
  ['all-distinct-answers-have-no-consensus', 'every answer different is maximum flakiness'],
  ['one-sample-agrees-with-itself', 'one sample is not evidence of determinism'],
  ['no-samples-measure-nothing', 'measuring nothing is not stability'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('the modal answer really is the most frequent one', () => {
  for (const entry of fixture.cases) {
    const { modal, modalCount } = run(entry);
    if (modal === null) continue;
    for (const answer of new Set(entry.samples)) {
      const count = entry.samples.filter((sample) => sample === answer).length;
      assert.ok(count <= modalCount, `${entry.id}: ${answer} appeared more often than the modal`);
    }
  }
});

test('shuffling the samples never changes the report', () => {
  for (const entry of fixture.cases) {
    const shuffled = [...entry.samples].reverse();
    assert.deepEqual(
      analyse(shuffled, fixture.consensusBps),
      run(entry),
      `${entry.id}: the report depends on sample order`,
    );
  }
});

test('agreement matches the modal count over the sample size', () => {
  for (const entry of fixture.cases) {
    const { modalCount, agreementBps } = run(entry);
    const rate =
      entry.samples.length === 0
        ? 0
        : Math.floor((modalCount * 10000) / entry.samples.length + 0.5);
    assert.equal(agreementBps, rate, `${entry.id}: agreement does not match the counts`);
  }
});

test('stability is exactly agreement clearing the bar', () => {
  for (const entry of fixture.cases) {
    const { agreementBps, stable, samples } = run(entry);
    const clears = samples > 0 && agreementBps >= fixture.consensusBps;
    assert.equal(stable, clears, `${entry.id}: stable disagrees with the agreement rate`);
  }
});
