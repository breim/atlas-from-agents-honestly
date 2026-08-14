import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Entry, Instruction, instruct as Instruct } from './start.ts';

interface Case {
  id: string;
  code: string;
  result: Instruction;
}

const fixture = expected<{
  chapter: string;
  catalogue: Record<string, Entry>;
  cases: Case[];
}>(import.meta.url);
const { instruct } = await loadImpl<{ instruct: typeof Instruct }>(import.meta.url);

const run = (entry: Case) => instruct(entry.code, fixture.catalogue);

const cases: Array<[string, string]> = [
  ['a-known-error-becomes-an-instruction', 'a catalogued failure tells the model what to do'],
  ['an-instruction-names-the-argument-to-change', 'the next call can be a corrected one'],
  ['a-transient-failure-says-to-try-again', 'a timeout is worth retrying'],
  ['an-unknown-code-does-not-invite-a-retry', 'silence about the remedy means stop'],
  ['a-missing-code-is-treated-as-unknown', 'an empty code is not a catalogue hit'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('every result carries a non-empty message', () => {
  for (const entry of fixture.cases) {
    assert.ok(run(entry).message.length > 0, `${entry.id}: an empty instruction`);
  }
});

test('nothing outside the catalogue is ever retryable', () => {
  for (const code of ['', 'nope', 'kernel_panic_0x8f', 'ORDER_NOT_FOUND']) {
    if (code in fixture.catalogue) continue;
    assert.equal(
      instruct(code, fixture.catalogue).retryable,
      false,
      `${code} was reported as retryable`,
    );
  }
});

test('a catalogued instruction is passed through verbatim', () => {
  for (const [code, entry] of Object.entries(fixture.catalogue)) {
    const result = instruct(code, fixture.catalogue);
    assert.equal(result.message, entry.instruction, `${code}: the instruction was rewritten`);
    assert.equal(result.retryable, entry.retryable, `${code}: retryability was overridden`);
    assert.deepEqual(result.fields, entry.fields, `${code}: the fields were changed`);
  }
});

test('an empty catalogue makes everything unknown', () => {
  for (const entry of fixture.cases) {
    const result = instruct(entry.code, {});
    assert.equal(result.retryable, false, `${entry.id}: retryable with no catalogue`);
    assert.deepEqual(result.fields, [], `${entry.id}: named fields with no catalogue`);
  }
});
