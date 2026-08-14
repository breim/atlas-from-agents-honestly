import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Field, Shaped, shape as Shape } from './start.ts';

interface Case {
  id: string;
  budget: number;
  present: string[];
  result: Shaped;
}

const fixture = expected<{ chapter: string; spec: Field[]; cases: Case[] }>(import.meta.url);
const { shape } = await loadImpl<{ shape: typeof Shape }>(import.meta.url);

const run = (entry: Case) => shape(entry.present, fixture.spec, entry.budget);

const cases: Array<[string, string]> = [
  ['a-small-result-keeps-everything-that-fits', 'a modest result is left whole'],
  ['an-oversized-optional-field-is-dropped', 'a huge optional payload does not travel'],
  ['optional-fields-are-kept-in-priority-order', 'the spec order is the priority order'],
  ['a-lower-priority-field-is-dropped-before-a-higher-one', 'the cheapest useful fields survive'],
  ['a-tight-budget-still-keeps-both-essentials', 'essentials outrank every optional field'],
  ['essentials-over-budget-do-not-fit-and-are-not-truncated', 'an over-budget result is reported'],
  ['a-field-not-in-the-spec-is-dropped', 'upstream fields do not leak into context'],
  ['a-missing-optional-field-is-simply-absent', 'an absent field is not an error'],
  ['an-empty-result-fits-trivially', 'nothing returned costs nothing'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('every present essential field is always kept', () => {
  for (const entry of fixture.cases) {
    const essentials = fixture.spec
      .filter((field) => field.essential && entry.present.includes(field.name))
      .map((field) => field.name);
    for (const name of essentials) {
      assert.ok(run(entry).kept.includes(name), `${entry.id}: dropped the essential ${name}`);
    }
  }
});

test('every present field is either kept or dropped, exactly once', () => {
  for (const entry of fixture.cases) {
    const { kept, dropped } = run(entry);
    assert.deepEqual([...kept, ...dropped].sort(), [...entry.present].sort(), entry.id);
  }
});

test('nothing outside the spec is ever kept', () => {
  const known = new Set(fixture.spec.map((field) => field.name));
  for (const entry of fixture.cases) {
    for (const name of run(entry).kept) {
      assert.ok(known.has(name), `${entry.id}: kept the unspecified ${name}`);
    }
  }
});

test('tokens is the cost of exactly what was kept', () => {
  for (const entry of fixture.cases) {
    const { kept, tokens } = run(entry);
    const cost = fixture.spec
      .filter((field) => kept.includes(field.name))
      .reduce((sum, field) => sum + field.tokens, 0);
    assert.equal(tokens, cost, `${entry.id}: the accounting does not match the fields`);
  }
});

test('fits is false exactly when the essentials alone are over budget', () => {
  for (const entry of fixture.cases) {
    const essentialCost = fixture.spec
      .filter((field) => field.essential && entry.present.includes(field.name))
      .reduce((sum, field) => sum + field.tokens, 0);
    assert.equal(run(entry).fits, essentialCost <= entry.budget, `${entry.id}: fits is wrong`);
  }
});

test('a bigger budget never keeps less', () => {
  for (const entry of fixture.cases) {
    const generous = shape(entry.present, fixture.spec, entry.budget + 1000);
    assert.ok(
      generous.kept.length >= run(entry).kept.length,
      `${entry.id}: more budget kept fewer fields`,
    );
  }
});
