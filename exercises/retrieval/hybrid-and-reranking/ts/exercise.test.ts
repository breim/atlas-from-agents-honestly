import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Comparison, Runs, compare as Compare } from './start.ts';

interface Case {
  id: string;
  relevant: string[];
  runs: Runs;
  result: Comparison;
}

const fixture = expected<{ chapter: string; k: number; cases: Case[] }>(import.meta.url);
const { compare } = await loadImpl<{ compare: typeof Compare }>(import.meta.url);

const run = (entry: Case) => compare(entry.runs, entry.relevant, fixture.k);

const cases: Array<[string, string]> = [
  ['hybrid-finds-what-neither-retriever-found-alone', 'fusion earns its cost'],
  ['hybrid-matches-the-better-retriever-and-buys-nothing', 'parity is not an improvement'],
  ['hybrid-loses-to-the-better-retriever', 'fusion can make retrieval worse'],
  ['each-retriever-finds-a-different-half', 'disjoint failures are what hybrid is for'],
  ['a-relevant-document-past-the-cut-helps-nobody', 'k applies to every run alike'],
  ['all-three-retrievers-fail-together', 'shared failures gain nothing'],
  ['a-query-with-no-relevant-documents-proves-nothing', 'a run everything passes proves nothing'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('every recall is a valid rate', () => {
  for (const entry of fixture.cases) {
    const { semanticBps, lexicalBps, hybridBps } = run(entry);
    for (const value of [semanticBps, lexicalBps, hybridBps]) {
      assert.ok(value >= 0 && value <= 10000, `${entry.id}: recall of ${value}`);
    }
  }
});

test('the verdict compares hybrid against the better single retriever', () => {
  for (const entry of fixture.cases) {
    const { semanticBps, lexicalBps, hybridBps, verdict } = run(entry);
    const best = Math.max(semanticBps, lexicalBps);
    const label = hybridBps > best ? 'gain' : hybridBps === best ? 'no_gain' : 'regression';
    assert.equal(verdict, label, `${entry.id}: the verdict does not follow the numbers`);
  }
});

test('swapping the two single retrievers never changes the verdict', () => {
  for (const entry of fixture.cases) {
    const swapped = { ...entry.runs, semantic: entry.runs.lexical, lexical: entry.runs.semantic };
    assert.equal(
      compare(swapped, entry.relevant, fixture.k).verdict,
      run(entry).verdict,
      `${entry.id}: the verdict depended on which retriever was called semantic`,
    );
  }
});

test('nothing past the cut counts for any run', () => {
  for (const entry of fixture.cases) {
    const trimmed: Runs = {
      semantic: entry.runs.semantic.slice(0, fixture.k),
      lexical: entry.runs.lexical.slice(0, fixture.k),
      hybrid: entry.runs.hybrid.slice(0, fixture.k),
    };
    assert.deepEqual(
      compare(trimmed, entry.relevant, fixture.k),
      run(entry),
      `${entry.id}: results past the cut affected the comparison`,
    );
  }
});

test('a hybrid run that recalls everything is never a regression', () => {
  for (const entry of fixture.cases) {
    if (entry.relevant.length === 0) continue;
    const perfect: Runs = { ...entry.runs, hybrid: entry.relevant.slice(0, fixture.k) };
    assert.notEqual(
      compare(perfect, entry.relevant, fixture.k).verdict,
      'regression',
      `${entry.id}: a maximal hybrid run was called a regression`,
    );
  }
});
