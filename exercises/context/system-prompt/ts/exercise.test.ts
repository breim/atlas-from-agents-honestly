import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Assembled, Block, SpecEntry, assemble as Assemble } from './start.ts';

interface Case {
  id: string;
  blocks: Block[];
  result: Assembled;
}

const fixture = expected<{ chapter: string; spec: SpecEntry[]; cases: Case[] }>(import.meta.url);
const { assemble } = await loadImpl<{ assemble: typeof Assemble }>(import.meta.url);

const run = (entry: Case) => assemble(entry.blocks, fixture.spec);

const cases: Array<[string, string]> = [
  ['blocks-render-in-spec-order-not-input-order', 'the spec decides the order'],
  ['a-missing-optional-block-is-simply-absent', 'an optional block is optional'],
  ['a-missing-required-block-is-reported', 'a missing policy is reported, not thrown'],
  ['an-unknown-block-is-ignored-not-appended', 'an unrecognised block cannot inject'],
  ['a-duplicate-block-keeps-the-first', 'a later block cannot overrule an earlier one'],
  ['every-optional-block-present-renders-in-full', 'a complete prompt renders in spec order'],
  ['no-blocks-yields-an-empty-prompt-and-reports-what-is-missing', 'nothing supplied is still a report'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('shuffling the input never changes the prompt', () => {
  for (const entry of fixture.cases) {
    // With duplicate names the order decides which block wins, so the prompt
    // is allowed to differ. Everywhere else it must not.
    const names = entry.blocks.map((block) => block.name);
    if (new Set(names).size !== names.length) continue;

    assert.equal(
      assemble([...entry.blocks].reverse(), fixture.spec).prompt,
      run(entry).prompt,
      `${entry.id}: the prompt depends on input order`,
    );
  }
});

test('no ignored block ever reaches the prompt', () => {
  for (const entry of fixture.cases) {
    const { prompt, ignored } = run(entry);
    for (const name of ignored) {
      const dropped = entry.blocks.filter((block) => block.name === name);
      const rendered = dropped.filter((block) => prompt.includes(block.text));
      assert.ok(
        rendered.length < dropped.length,
        `${entry.id}: every ${name} block reached the prompt`,
      );
    }
  }
});

test('the prompt is built only from blocks the spec names', () => {
  for (const entry of fixture.cases) {
    const { prompt } = run(entry);
    const allowed = new Set(fixture.spec.map((spec) => spec.name));
    for (const block of entry.blocks) {
      if (allowed.has(block.name)) continue;
      assert.ok(!prompt.includes(block.text), `${entry.id}: ${block.name} leaked into the prompt`);
    }
  }
});

test('every required block is either rendered or reported missing', () => {
  for (const entry of fixture.cases) {
    const { prompt, missing } = run(entry);
    for (const spec of fixture.spec.filter((entry) => entry.required)) {
      const supplied = entry.blocks.find((block) => block.name === spec.name);
      if (missing.includes(spec.name)) {
        assert.equal(supplied, undefined, `${entry.id}: reported ${spec.name} missing but had it`);
      } else {
        assert.ok(prompt.includes(supplied!.text), `${entry.id}: ${spec.name} silently vanished`);
      }
    }
  }
});
