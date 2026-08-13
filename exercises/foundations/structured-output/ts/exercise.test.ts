import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Field, Parsed, parse as Parse } from './start.ts';

interface Case {
  id: string;
  text: string;
  result: Parsed;
}

const fixture = expected<{ chapter: string; schema: Field[]; cases: Case[] }>(import.meta.url);
const { parse } = await loadImpl<{ parse: typeof Parse }>(import.meta.url);

const run = (entry: Case) => parse(entry.text, fixture.schema);

const cases: Array<[string, string]> = [
  ['clean-json-parses', 'a well-formed object parses'],
  ['json-wrapped-in-prose-is-extracted', 'chattiness around the JSON is survivable'],
  ['json-in-a-fenced-block-is-extracted', 'so is a code fence'],
  ['a-missing-required-field-is-rejected', 'an absent field is an error'],
  ['a-wrong-type-is-rejected-not-coerced', 'a numeric string is not a number'],
  ['a-boolean-as-a-string-is-still-the-wrong-type', 'nor is "true" a boolean'],
  ['an-unknown-field-is-rejected', 'the model cannot add fields'],
  ['malformed-json-is-rejected', 'broken JSON is not repaired'],
  ['no-json-at-all-is-rejected', 'a refusal is not an object'],
  ['a-missing-field-is-reported-before-an-unknown-one', 'the error order is fixed'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('a successful parse holds exactly the schema fields', () => {
  for (const entry of fixture.cases) {
    const result = run(entry);
    if (!result.ok) continue;
    assert.deepEqual(
      Object.keys(result.value).sort(),
      fixture.schema.map((field) => field.name).sort(),
      `${entry.id}: the parsed object does not match the schema`,
    );
  }
});

test('every parsed field has its declared type', () => {
  for (const entry of fixture.cases) {
    const result = run(entry);
    if (!result.ok) continue;
    for (const field of fixture.schema) {
      assert.equal(
        typeof result.value[field.name],
        field.type,
        `${entry.id}: ${field.name} came back as the wrong type`,
      );
    }
  }
});

test('nothing ever throws, whatever the model produced', () => {
  const hostile = ['', '{', '}', '{{}}', 'null', '[]', '{"a":', '}{'];
  for (const text of hostile) {
    assert.doesNotThrow(() => parse(text, fixture.schema), `${JSON.stringify(text)} threw`);
  }
});

test('a rejection always names what was wrong', () => {
  for (const entry of fixture.cases) {
    const result = run(entry);
    if (result.ok) continue;
    assert.ok(result.error.length > 0, `${entry.id}: rejected without a reason`);
  }
});
