import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Quality, Triple, evaluate as Evaluate } from './start.ts';

interface Case {
  id: string;
  gold: Triple[];
  extracted: Triple[];
  result: Quality;
}

const fixture = expected<{ chapter: string; cases: Case[] }>(import.meta.url);
const { evaluate } = await loadImpl<{ evaluate: typeof Evaluate }>(import.meta.url);

const run = (entry: Case) => evaluate(entry.extracted, entry.gold);
const key = (triple: Triple) => `${triple.from}|${triple.type}|${triple.to}`;

const cases: Array<[string, string]> = [
  ['a-perfect-extraction', 'a correct graph scores full marks'],
  ['a-hallucinated-triple-costs-precision-only', 'an invented fact is a precision problem'],
  ['a-missed-triple-costs-recall-only', 'a skipped fact is a recall problem'],
  ['the-right-endpoints-with-the-wrong-relation-is-a-different-fact', 'no partial credit'],
  ['a-reversed-triple-is-also-a-different-fact', 'direction is part of the fact'],
  ['extracting-nothing-has-perfect-precision-and-no-recall', 'silence is perfectly precise'],
  ['an-empty-gold-graph-cannot-be-recalled-wrongly', 'nothing to recall is full recall'],
  ['both-empty-is-vacuously-perfect', 'nothing in, nothing wrong'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('spurious and missed are exactly the disagreements', () => {
  for (const entry of fixture.cases) {
    const truth = new Set(entry.gold.map(key));
    const claimed = new Set(entry.extracted.map(key));
    const { spurious, missed } = run(entry);
    assert.deepEqual(spurious, entry.extracted.filter((t) => !truth.has(key(t))), entry.id);
    assert.deepEqual(missed, entry.gold.filter((t) => !claimed.has(key(t))), entry.id);
  }
});

test('the rates agree with the disagreements', () => {
  for (const entry of fixture.cases) {
    const { precisionBps, recallBps, spurious, missed } = run(entry);
    const bps = (n: number, d: number) => (d === 0 ? 10000 : Math.floor((n * 10000) / d + 0.5));
    assert.equal(precisionBps, bps(entry.extracted.length - spurious.length, entry.extracted.length));
    assert.equal(recallBps, bps(entry.gold.length - missed.length, entry.gold.length));
  }
});

test('a triple with any part changed is never counted as correct', () => {
  for (const entry of fixture.cases) {
    if (entry.gold.length === 0) continue;
    const [first] = entry.gold;
    for (const mutated of [
      { ...first, from: 'other' },
      { ...first, type: 'other' },
      { ...first, to: 'other' },
      { from: first.to, type: first.type, to: first.from },
    ]) {
      const { spurious } = evaluate([mutated], entry.gold);
      assert.equal(spurious.length, 1, `${entry.id}: ${key(mutated)} was accepted as correct`);
    }
  }
});

test('every score is a valid rate', () => {
  for (const entry of fixture.cases) {
    const { precisionBps, recallBps } = run(entry);
    for (const value of [precisionBps, recallBps]) {
      assert.ok(value >= 0 && value <= 10000, `${entry.id}: rate of ${value}`);
    }
  }
});
