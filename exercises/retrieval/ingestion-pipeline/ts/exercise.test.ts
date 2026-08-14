import assert from 'node:assert/strict';
import test from 'node:test';
import { expected, findCase, loadImpl } from '#harness';
import type { Config, Index, Run, Source, ingest as Ingest } from './start.ts';

interface Case {
  id: string;
  pipelineVersion?: string;
  sources: Source[];
  result: Run;
}

interface Fixture {
  chapter: string;
  config: Config;
  index: Index;
  cases: Case[];
}

const fixture = expected<Fixture>(import.meta.url);
const { ingest } = await loadImpl<{ ingest: typeof Ingest }>(import.meta.url);

const configOf = (entry: Case) =>
  entry.pipelineVersion ? { ...fixture.config, pipelineVersion: entry.pipelineVersion } : fixture.config;

const go = (entry: Case, sources = entry.sources, index: Index = fixture.index, config = configOf(entry)) =>
  ingest(sources, index, config);

const cases: Array<[string, string]> = [
  ['an-unchanged-document-is-skipped-not-reparsed', 'the hash matched, so nothing happened'],
  ['a-timestamp-that-moved-without-the-content-changes-nothing', 'not by timestamp'],
  ['a-changed-document-is-reindexed-and-its-old-chunks-replaced', 'replaced, not appended'],
  ['a-document-deleted-upstream-stops-being-searchable', 'the part almost nobody implements'],
  ['a-document-with-no-tenant-is-rejected-not-indexed-untagged', 'fail loudly'],
  ['a-parse-failure-is-named-in-the-manifest-not-silently-skipped', 'do you know which thirteen'],
  ['a-pipeline-version-bump-reindexes-everything', 'why pipeline_ver is on every row'],
  ['reconciliation-removes-exactly-what-the-source-no-longer-has', 'list, diff, remove'],
];

for (const [id, title] of cases) {
  test(title, () => {
    const entry = findCase<Case>(fixture, id);
    assert.deepEqual(go(entry), entry.result);
  });
}

test('running the pipeline again over its own output changes nothing', () => {
  for (const entry of fixture.cases) {
    const first = go(entry);
    const second = go(entry, entry.sources, { chunks: first.chunks });
    assert.deepEqual(second.chunks, first.chunks, `${entry.id}: a second run moved the corpus`);
    assert.equal(second.manifest.chunksProduced, 0, `${entry.id}: a second run re-embedded everything`);
    assert.deepEqual(second.manifest.reindexed, [], `${entry.id}: a second run found work to do`);
    assert.deepEqual(second.manifest.tombstoned, [], `${entry.id}: a second run tombstoned again`);
  }
});

test('a re-run after a partial failure replaces chunks instead of doubling them', () => {
  for (const entry of fixture.cases) {
    const ids = go(entry).chunks.map((chunk) => chunk.id);
    assert.equal(new Set(ids).size, ids.length, `${entry.id}: the corpus contains a duplicate chunk`);
  }
  const changed = findCase<Case>(fixture, 'a-changed-document-is-reindexed-and-its-old-chunks-replaced');
  const outcome = go(changed);
  const stale = outcome.chunks.filter((chunk) => chunk.documentId === 'POL-114' && chunk.contentHash === 'h114a');
  assert.deepEqual(stale, [], 'the previous version of the document survived the reindex');
});

test('chunk identity is the document and its position, nothing else', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    const byDocument = new Map<string, string[]>();
    for (const chunk of outcome.chunks) {
      byDocument.set(chunk.documentId, [...(byDocument.get(chunk.documentId) ?? []), chunk.id]);
    }
    for (const [documentId, ids] of byDocument) {
      assert.deepEqual(
        ids,
        ids.map((_, position) => `${documentId}#${position}`),
        `${entry.id}: ${documentId} does not have contiguous, position-keyed chunk ids`,
      );
    }
  }
});

test('a document is skipped exactly when its hash and pipeline version both match', () => {
  for (const entry of fixture.cases) {
    const config = configOf(entry);
    const outcome = go(entry);
    for (const source of entry.sources) {
      if (!source.parseOk) continue;
      const existing = fixture.index.chunks.filter((chunk) => chunk.documentId === source.documentId);
      const owed =
        existing.length > 0 &&
        existing.every(
          (chunk) => chunk.contentHash === source.contentHash && chunk.pipelineVersion === config.pipelineVersion,
        ) &&
        !outcome.manifest.rejected.some((item) => item.documentId === source.documentId);
      assert.equal(
        outcome.manifest.skipped.includes(source.documentId),
        owed,
        `${entry.id}: ${source.documentId} was skipped wrongly`,
      );
    }
  }
});

test('only the content hash decides whether work happens', () => {
  const entry = findCase<Case>(fixture, 'an-unchanged-document-is-skipped-not-reparsed');
  const touched = entry.sources.map((source) => ({ ...source, modifiedAt: '2099-12-31' }));
  assert.deepEqual(go(entry, touched), go(entry), 'a timestamp moved the pipeline');
  const edited = entry.sources.map((source) => ({ ...source, contentHash: `${source.contentHash}-new` }));
  const after = go(entry, edited);
  assert.deepEqual(after.manifest.skipped, [], 'a changed hash was skipped anyway');
  assert.deepEqual(
    after.manifest.reindexed,
    entry.sources.map((source) => source.documentId),
    'a changed hash did not reindex',
  );
});

test('everything the source no longer has is tombstoned, and nothing else is', () => {
  for (const entry of fixture.cases) {
    const present = new Set(entry.sources.map((source) => source.documentId));
    const indexed = [...new Set(fixture.index.chunks.map((chunk) => chunk.documentId))];
    const owed = indexed.filter((documentId) => !present.has(documentId));
    assert.deepEqual(go(entry).manifest.tombstoned, owed, `${entry.id}: reconciliation was wrong`);
  }
});

test('a tombstoned document leaves no chunk behind', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    for (const documentId of outcome.manifest.tombstoned) {
      assert.ok(
        !outcome.chunks.some((chunk) => chunk.documentId === documentId),
        `${entry.id}: ${documentId} was tombstoned and still searchable`,
      );
    }
  }
});

test('a parse failure never deletes what was already indexed', () => {
  const entry = findCase<Case>(fixture, 'a-parse-failure-is-named-in-the-manifest-not-silently-skipped');
  const outcome = go(entry);
  assert.ok(outcome.manifest.failed.length > 0, 'the fixture no longer fails a parse');
  for (const failure of outcome.manifest.failed) {
    assert.ok(failure.reason.length > 0, `${failure.documentId} failed without a reason`);
    assert.ok(!outcome.manifest.tombstoned.includes(failure.documentId), 'a parse failure deleted a document');
  }
});

test('nothing is ever indexed without the metadata the filters need', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    for (const chunk of outcome.chunks) {
      for (const field of fixture.config.requiredMetadata) {
        const value = chunk[field as 'tenantId' | 'version'];
        assert.ok(value !== null && value !== undefined && value !== '', `${entry.id}: ${chunk.id} lacks ${field}`);
      }
    }
    for (const rejection of outcome.manifest.rejected) {
      assert.ok(!outcome.manifest.reindexed.includes(rejection.documentId), `${entry.id}: a rejection was indexed`);
      const source = entry.sources.find((item) => item.documentId === rejection.documentId)!;
      assert.ok(
        !outcome.chunks.some((chunk) => chunk.contentHash === source.contentHash),
        `${entry.id}: ${rejection.documentId} was rejected and its content indexed anyway`,
      );
    }
  }
});

test('every chunk carries the pipeline version that produced this index', () => {
  for (const entry of fixture.cases) {
    const config = configOf(entry);
    const outcome = go(entry);
    for (const documentId of outcome.manifest.reindexed) {
      for (const chunk of outcome.chunks.filter((item) => item.documentId === documentId)) {
        assert.equal(chunk.pipelineVersion, config.pipelineVersion, `${entry.id}: ${chunk.id} has a stale version`);
      }
    }
  }
});

test('a pipeline version bump leaves nothing on the old version', () => {
  const entry = findCase<Case>(fixture, 'an-unchanged-document-is-skipped-not-reparsed');
  const bumped = { ...fixture.config, pipelineVersion: 'e5-large/chunk-v9/3072' };
  const outcome = go(entry, entry.sources, fixture.index, bumped);
  assert.deepEqual(outcome.manifest.skipped, [], 'a version bump skipped a document');
  for (const chunk of outcome.chunks) {
    assert.equal(chunk.pipelineVersion, bumped.pipelineVersion, `${chunk.id} survived the bump unchanged`);
  }
});

test('the manifest accounts for every document and reconciles against the index', () => {
  for (const entry of fixture.cases) {
    const { manifest, chunks } = go(entry);
    assert.equal(manifest.attempted, entry.sources.length, `${entry.id}: attempted is not the source count`);
    assert.equal(manifest.sourceCount, entry.sources.length, entry.id);
    assert.equal(manifest.indexedCount, chunks.length, `${entry.id}: the manifest disagrees with the index`);
    assert.equal(
      manifest.parsed,
      entry.sources.filter((source) => source.parseOk).length,
      `${entry.id}: parsed is not what parsed`,
    );
    assert.equal(manifest.parsed + manifest.failed.length, manifest.attempted, `${entry.id}: a document vanished`);

    const accounted = [
      ...manifest.skipped,
      ...manifest.reindexed,
      ...manifest.rejected.map((item) => item.documentId),
      ...manifest.failed.map((item) => item.documentId),
    ];
    assert.deepEqual(
      [...accounted].sort(),
      entry.sources.map((source) => source.documentId).sort(),
      `${entry.id}: a document was double-counted or unaccounted for`,
    );
  }
});

test('chunksProduced is exactly what was written this run', () => {
  for (const entry of fixture.cases) {
    const outcome = go(entry);
    const owed = entry.sources
      .filter((source) => outcome.manifest.reindexed.includes(source.documentId))
      .reduce((total, source) => total + source.chunkCount, 0);
    assert.equal(outcome.manifest.chunksProduced, owed, `${entry.id}: the count disagrees with the work`);
  }
});
