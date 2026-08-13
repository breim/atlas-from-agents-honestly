import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Context, isolate as Isolate, merge as Merge } from './start.ts';

interface Case {
  id: string;
  kind: 'isolate' | 'merge';
  allow?: string[];
  child?: Context;
  result?: Context;
  expose?: string[];
  merged?: Context;
}

const fixture = expected<{ chapter: string; parent: Context; cases: Case[] }>(import.meta.url);
const { isolate, merge } = await loadImpl<{ isolate: typeof Isolate; merge: typeof Merge }>(
  import.meta.url,
);

const isolations: Array<[string, string]> = [
  ['child-sees-only-allowed-keys', 'the child gets the allowlist and nothing else'],
  ['a-secret-outside-the-allowlist-never-reaches-the-child', 'a credential is not inherited'],
  ['an-empty-allowlist-yields-an-empty-child', 'an empty allowlist is not a pass-through'],
  ['an-allowed-key-the-parent-lacks-is-simply-absent', 'a missing key is absent, not undefined'],
];

for (const [id, title] of isolations) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(isolate(fixture.parent, entry.allow!), entry.child);
  });
}

const merges: Array<[string, string]> = [
  ['merge-brings-back-only-exposed-keys', 'only the exposed key comes home'],
  ['an-unexposed-key-cannot-overwrite-the-parent', 'a hostile return value changes nothing'],
  ['an-exposed-key-may-overwrite-the-parent', 'an exposed key is allowed to win'],
];

for (const [id, title] of merges) {
  test(title, () => {
    const entry = findCase(fixture, id);
    assert.deepEqual(merge(fixture.parent, entry.result!, entry.expose!), entry.merged);
  });
}

test('neither direction mutates the parent', () => {
  const snapshot = structuredClone(fixture.parent);
  for (const entry of fixture.cases) {
    if (entry.kind === 'isolate') isolate(fixture.parent, entry.allow!);
    else merge(fixture.parent, entry.result!, entry.expose!);
  }
  assert.deepEqual(fixture.parent, snapshot);
});

test('the child never holds a key outside its allowlist', () => {
  for (const entry of fixture.cases) {
    if (entry.kind !== 'isolate') continue;
    for (const key of Object.keys(isolate(fixture.parent, entry.allow!))) {
      assert.ok(entry.allow!.includes(key), `${entry.id}: leaked ${key} into the child`);
    }
  }
});
