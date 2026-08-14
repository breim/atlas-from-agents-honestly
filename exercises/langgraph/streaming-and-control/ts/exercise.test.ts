import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Assembled, Chunk, assemble as Assemble } from './start.ts';

interface Case {
  id: string;
  chunks: Chunk[];
  result: Assembled;
}

const fixture = expected<{ chapter: string; cases: Case[] }>(import.meta.url);
const { assemble } = await loadImpl<{ assemble: typeof Assemble }>(import.meta.url);

const run = (entry: Case) => assemble(entry.chunks);

const cases: Array<[string, string]> = [
  ['a-clean-text-stream-assembles', 'text chunks concatenate in order'],
  ['a-tool-call-assembles-from-its-fragments', 'arguments arrive in pieces'],
  ['text-and-tool-calls-interleave', 'text around a call is still one answer'],
  ['a-stream-cut-short-is-incomplete', 'a fragment is not a final answer'],
  ['an-unclosed-tool-call-is-never-emitted', 'truncated arguments never reach a dispatcher'],
  ['a-closed-call-survives-a-later-truncation', 'what closed is real'],
  ['two-tool-calls-keep-their-order', 'calls come back in stream order'],
  ['an-empty-stream-is-incomplete', 'nothing received is not a clean finish'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('complete is true only when the stream said so', () => {
  for (const entry of fixture.cases) {
    assert.equal(
      run(entry).complete,
      entry.chunks.some((chunk) => chunk.type === 'done'),
      `${entry.id}: completeness was inferred rather than read`,
    );
  }
});

test('every emitted call was closed', () => {
  for (const entry of fixture.cases) {
    const closed = entry.chunks.filter((chunk) => chunk.type === 'tool_end').length;
    assert.equal(run(entry).toolCalls.length, closed, `${entry.id}: emitted an unclosed call`);
  }
});

test('every emitted call names a tool the stream opened', () => {
  for (const entry of fixture.cases) {
    const opened = entry.chunks
      .filter((chunk) => chunk.type === 'tool_start')
      .map((chunk) => chunk.value);
    for (const call of run(entry).toolCalls) {
      assert.ok(opened.includes(call.name), `${entry.id}: invented the call ${call.name}`);
    }
  }
});

test('truncating a stream never adds text or calls', () => {
  for (const entry of fixture.cases) {
    const full = run(entry);
    for (let cut = 0; cut < entry.chunks.length; cut += 1) {
      const partial = assemble(entry.chunks.slice(0, cut));
      assert.ok(full.text.startsWith(partial.text), `${entry.id}: text diverged at ${cut}`);
      assert.ok(
        partial.toolCalls.length <= full.toolCalls.length,
        `${entry.id}: a shorter stream produced more calls`,
      );
    }
  }
});

test('nothing throws on a malformed stream', () => {
  const hostile: Chunk[][] = [
    [{ type: 'tool_arg', value: 'orphan' }],
    [{ type: 'tool_end' }],
    [{ type: 'tool_end' }, { type: 'tool_end' }],
    [{ type: 'text' }],
  ];
  for (const chunks of hostile) {
    assert.doesNotThrow(() => assemble(chunks), `${JSON.stringify(chunks)} threw`);
  }
});
