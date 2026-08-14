import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Reconciliation, Record, Snapshot, reconcile as Reconcile } from './start.ts';

interface Case {
  id: string;
  snapshot: Snapshot;
  projection: Record[];
  result: Reconciliation;
}

const fixture = expected<{ chapter: string; cases: Case[] }>(import.meta.url);
const { reconcile } = await loadImpl<{ reconcile: typeof Reconcile }>(import.meta.url);

const run = (entry: Case) => reconcile(entry.snapshot, entry.projection);
const ids = (records: Record[]) => records.map((record) => record.id);

const cases: Array<[string, string]> = [
  ['a-replica-that-matches-the-source-is-in-sync', 'an equal replica reports nothing to repair'],
  ['a-clean-event-log-still-leaves-a-record-missing', 'the event that never arrived left no trace'],
  ['an-older-version-in-the-projection-is-stale', 'a behind version needs refetching'],
  ['a-newer-version-in-the-projection-is-not-stale', 'an ahead version is skew, not staleness'],
  ['a-record-the-source-dropped-is-extra', 'a tombstone that never applied'],
  ['a-partial-snapshot-never-derives-a-deletion', 'page four might have held it'],
  ['a-partial-snapshot-still-reports-what-it-did-see', 'a partial listing still proves existence'],
  ['a-matching-partial-snapshot-is-still-not-in-sync', 'agreement with half the truth proves nothing'],
  ['the-lists-follow-snapshot-order-then-projection-order', 'the report order is fixed'],
  ['an-empty-source-empties-the-projection', 'everything local is now extra'],
  ['two-empty-sides-are-in-sync', 'nothing on either side agrees trivially'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(run(entry), entry.result);
  });
}

test('a partial snapshot never reports anything as extra', () => {
  for (const entry of fixture.cases) {
    if (entry.snapshot.complete) continue;
    assert.deepEqual(run(entry).extra, [], `${entry.id}: derived a deletion from an incomplete listing`);
  }
});

test('a partial snapshot is never in sync', () => {
  for (const entry of fixture.cases) {
    if (entry.snapshot.complete) continue;
    assert.equal(run(entry).inSync, false, `${entry.id}: declared a replica sound on partial evidence`);
  }
});

test('inSync is true exactly when the snapshot is complete and nothing differs', () => {
  for (const entry of fixture.cases) {
    const { missing, stale, ahead, extra, inSync } = run(entry);
    const clean = [missing, stale, ahead, extra].every((list) => list.length === 0);
    assert.equal(inSync, entry.snapshot.complete && clean, `${entry.id}: inSync disagrees with the diff`);
  }
});

test('every reported id comes from one of the two sides', () => {
  for (const entry of fixture.cases) {
    const known = new Set([...ids(entry.snapshot.records), ...ids(entry.projection)]);
    const { missing, stale, ahead, extra } = run(entry);
    for (const id of [...missing, ...stale, ...ahead, ...extra]) {
      assert.ok(known.has(id), `${entry.id}: reported ${id}, which neither side holds`);
    }
  }
});

test('no id is ever reported in two categories at once', () => {
  for (const entry of fixture.cases) {
    const { missing, stale, ahead, extra } = run(entry);
    const all = [...missing, ...stale, ...ahead, ...extra];
    assert.equal(new Set(all).size, all.length, `${entry.id}: an id was diagnosed twice`);
  }
});

test('missing and extra hold only ids the other side does not have', () => {
  for (const entry of fixture.cases) {
    const source = new Set(ids(entry.snapshot.records));
    const local = new Set(ids(entry.projection));
    const { missing, extra } = run(entry);
    for (const id of missing) {
      assert.ok(source.has(id) && !local.has(id), `${entry.id}: ${id} is not missing`);
    }
    for (const id of extra) {
      assert.ok(local.has(id) && !source.has(id), `${entry.id}: ${id} is not extra`);
    }
  }
});

test('stale and ahead hold only ids both sides have, on the right side of the version', () => {
  for (const entry of fixture.cases) {
    const source = new Map(entry.snapshot.records.map((record) => [record.id, record.version]));
    const local = new Map(entry.projection.map((record) => [record.id, record.version]));
    const { stale, ahead } = run(entry);
    for (const id of stale) {
      assert.ok(local.get(id)! < source.get(id)!, `${entry.id}: ${id} is not behind the source`);
    }
    for (const id of ahead) {
      assert.ok(local.get(id)! > source.get(id)!, `${entry.id}: ${id} is not past the source`);
    }
  }
});

test('reconciling a projection against itself finds nothing to repair', () => {
  for (const entry of fixture.cases) {
    const result = reconcile({ complete: true, records: entry.projection }, entry.projection);
    assert.deepEqual(result, { missing: [], stale: [], ahead: [], extra: [], inSync: true }, entry.id);
  }
});

test('applying the repair makes the replica match a complete source', () => {
  for (const entry of fixture.cases) {
    if (!entry.snapshot.complete) continue;
    const repaired = entry.snapshot.records.map((record) => ({ ...record }));
    assert.deepEqual(reconcile(entry.snapshot, repaired).inSync, true, `${entry.id}: repair did not converge`);
  }
});
