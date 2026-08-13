import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Guarded, Rule, guard as Guard } from './start.ts';

interface Case {
  id: string;
  text: string;
  result: Guarded;
}

const fixture = expected<{ chapter: string; rules: Rule[]; cases: Case[] }>(import.meta.url);
const { guard } = await loadImpl<{ guard: typeof Guard }>(import.meta.url);

const run = (entry: Case) => guard(entry.text, fixture.rules);

const cases: Array<[string, string]> = [
  ['clean-output-passes-through', 'nothing to catch means nothing changes'],
  ['a-redactable-secret-is-masked', 'a redactable hit is replaced'],
  ['every-occurrence-is-redacted', 'the second occurrence is not left behind'],
  ['a-credential-blocks-the-whole-response', 'a leaked key is not a formatting problem'],
  ['blocking-wins-over-redacting', 'a response tripping both rules is blocked'],
  ['a-blocked-response-releases-nothing-not-a-partial', 'blocking does not release the surroundings'],
  ['a-label-is-reported-once-however-many-times-it-hits', 'hits are labels, not occurrences'],
  ['empty-output-is-clean', 'an empty response is releasable'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('no released text ever contains a rule pattern', () => {
  for (const entry of fixture.cases) {
    const { released, text } = run(entry);
    if (!released) continue;
    for (const rule of fixture.rules) {
      assert.ok(!text.includes(rule.pattern), `${entry.id}: ${rule.label} survived into the output`);
    }
  }
});

test('a blocked response releases nothing at all', () => {
  for (const entry of fixture.cases) {
    const { released, text } = run(entry);
    if (released) continue;
    assert.equal(text, '', `${entry.id}: released ${text.length} characters of a blocked response`);
  }
});

test('hits are exactly the rules that matched, once each, in rule order', () => {
  for (const entry of fixture.cases) {
    const matched = fixture.rules
      .filter((rule) => entry.text.includes(rule.pattern))
      .map((rule) => rule.label);
    assert.deepEqual(run(entry).hits, matched, `${entry.id}: hits do not match the rules`);
  }
});

test('any text containing a blocking pattern is blocked', () => {
  const blocking = fixture.rules.filter((rule) => rule.action === 'block');
  for (const rule of blocking) {
    for (const wrapper of ['%s', 'before %s', '%s after', 'a %s b']) {
      const text = wrapper.replace('%s', rule.pattern);
      assert.equal(guard(text, fixture.rules).released, false, `"${text}" was released`);
    }
  }
});
