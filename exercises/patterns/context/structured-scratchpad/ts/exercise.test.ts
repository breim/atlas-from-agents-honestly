import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Write, render as Render } from './start.ts';

interface Case {
  id: string;
  writes: Write[];
  rendered: string;
}

const fixture = expected<{ chapter: string; cases: Case[] }>(import.meta.url);
const { render } = await loadImpl<{ render: typeof Render }>(import.meta.url);

const cases: Array<[string, string]> = [
  ['empty-pad', 'an empty pad renders as an empty string, not a stray newline'],
  ['single-write', 'one write renders one line'],
  ['keys-render-in-first-write-order', 'distinct keys keep the order they were first written'],
  ['last-write-wins', 'writing a key twice leaves one line'],
  ['overwrite-keeps-its-position', 'revising a key edits its line in place'],
  ['repeated-write-of-the-same-value', 'rewriting the same value changes nothing'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.equal(render(entry.writes), entry.rendered);
  });
}

test('one line per distinct key, always', () => {
  for (const entry of fixture.cases) {
    const keys = new Set(entry.writes.map((write) => write.key));
    const lines = render(entry.writes) === '' ? [] : render(entry.writes).split('\n');
    assert.equal(lines.length, keys.size, `${entry.id}: ${lines.length} lines for ${keys.size} keys`);
  }
});

test('a revision never moves an earlier key', () => {
  for (const entry of fixture.cases) {
    const rendered = render(entry.writes);
    const order = rendered === '' ? [] : rendered.split('\n').map((line) => line.split('=')[0]);
    const firstWrites = [...new Set(entry.writes.map((write) => write.key))];
    assert.deepEqual(order, firstWrites, `${entry.id}: key order drifted from first-write order`);
  }
});
