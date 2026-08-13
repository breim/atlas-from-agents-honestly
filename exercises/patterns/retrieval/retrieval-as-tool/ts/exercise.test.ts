import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Result, dispatch as Dispatch } from './start.ts';

interface Case {
  id: string;
  args: Record<string, unknown>;
  result: Result;
}

const fixture = expected<{
  chapter: string;
  maxTopK: number;
  corpus: Record<string, string[]>;
  cases: Case[];
}>(import.meta.url);
const { dispatch } = await loadImpl<{ dispatch: typeof Dispatch }>(import.meta.url);

const run = (entry: Case) => dispatch(entry.args, fixture.corpus, fixture.maxTopK);

const cases: Array<[string, string]> = [
  ['a-valid-call-returns-hits', 'a well-formed call retrieves'],
  ['topk-trims-the-hits', 'topK caps the result'],
  ['a-query-with-no-hits-is-a-success-not-an-error', 'finding nothing is an answer'],
  ['a-missing-query-is-rejected', 'a missing required argument is named'],
  ['an-empty-query-is-rejected', 'whitespace is not a query'],
  ['a-non-string-query-is-rejected-not-coerced', 'a number is not silently stringified'],
  ['topk-below-one-is-rejected', 'zero results is not a legal request'],
  ['topk-above-the-ceiling-is-rejected', 'the ceiling is enforced, not clamped'],
  ['a-fractional-topk-is-rejected', 'a fractional count is not rounded'],
  ['an-unknown-argument-is-rejected', 'the model cannot widen its own scope'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('no input ever throws', () => {
  const hostile = [{}, { query: null }, { topK: 'two' }, { query: 'returns' }, { nope: 1 }];
  for (const args of hostile) {
    assert.doesNotThrow(
      () => dispatch(args, fixture.corpus, fixture.maxTopK),
      `${JSON.stringify(args)} escaped as an exception`,
    );
  }
});

test('every rejection carries a code and a message the model can act on', () => {
  for (const entry of fixture.cases) {
    const result = run(entry);
    if (result.ok) continue;
    assert.ok(result.error.length > 0, `${entry.id}: rejection without a code`);
    assert.ok(result.message.length > 0, `${entry.id}: rejection without a message`);
  }
});

test('a successful call never returns more than it was asked for', () => {
  for (const entry of fixture.cases) {
    const result = run(entry);
    if (!result.ok) continue;
    assert.ok(
      result.hits.length <= (entry.args.topK as number),
      `${entry.id}: returned more hits than topK`,
    );
  }
});
