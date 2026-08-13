import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Entity, Signal, apply as Apply } from './start.ts';

interface Case {
  id: string;
  signals: Signal[];
  result: Entity;
}

const fixture = expected<{ chapter: string; cases: Case[] }>(import.meta.url);
const { apply } = await loadImpl<{ apply: typeof Apply }>(import.meta.url);

const cases: Array<[string, string]> = [
  ['an-entity-accumulates-state-across-signals', 'state survives from signal to signal'],
  ['a-replayed-signal-is-applied-once', 'a redelivery does not double the state'],
  ['deduplication-is-by-id-not-by-content', 'two real events with equal payloads both count'],
  ['a-duplicate-id-with-different-content-is-still-a-duplicate', 'the first delivery wins'],
  ['a-duplicate-arriving-much-later-is-still-caught', 'the entity remembers for its whole life'],
  ['an-unknown-kind-is-ignored-without-failing-the-entity', 'one bad signal is not an outage'],
  ['an-entity-with-no-signals-is-still-a-valid-entity', 'an empty entity is a valid entity'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(apply(entry.signals), entry.result);
  });
}

test('every signal is either applied or ignored, exactly once', () => {
  for (const entry of fixture.cases) {
    const { applied, ignored } = apply(entry.signals);
    assert.equal(
      applied.length + ignored.length,
      entry.signals.length,
      `${entry.id}: a signal was lost or counted twice`,
    );
  }
});

test('no id is applied more than once', () => {
  for (const entry of fixture.cases) {
    const { applied } = apply(entry.signals);
    assert.equal(new Set(applied).size, applied.length, `${entry.id}: applied a duplicate`);
  }
});

test('the state holds exactly one note per applied signal', () => {
  for (const entry of fixture.cases) {
    const { notes, applied } = apply(entry.signals);
    assert.equal(notes.length, applied.length, `${entry.id}: notes and applied disagree`);
    const firstValues = applied.map(
      (id) => entry.signals.find((signal) => signal.id === id)!.value,
    );
    assert.deepEqual(notes, firstValues, `${entry.id}: a later delivery overwrote the first`);
  }
});
