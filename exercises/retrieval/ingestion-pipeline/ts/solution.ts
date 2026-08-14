export interface Source {
  documentId: string;
  contentHash: string;
  tenantId: string | null;
  version: number | null;
  chunkCount: number;
  parseOk: boolean;
  parseError?: string;
  modifiedAt: string;
}

export interface Chunk {
  id: string;
  documentId: string;
  version: number;
  tenantId: string;
  contentHash: string;
  pipelineVersion: string;
}

export interface Index {
  chunks: Chunk[];
}

export interface Config {
  pipelineVersion: string;
  requiredMetadata: string[];
}

export interface Manifest {
  attempted: number;
  parsed: number;
  failed: Array<{ documentId: string; reason: string }>;
  rejected: Array<{ documentId: string; reason: string }>;
  skipped: string[];
  reindexed: string[];
  tombstoned: string[];
  chunksProduced: number;
  sourceCount: number;
  indexedCount: number;
}

export interface Run {
  chunks: Chunk[];
  manifest: Manifest;
}

export function ingest(sources: Source[], index: Index, config: Config): Run {
  const chunks: Chunk[] = [];
  const manifest: Manifest = {
    attempted: sources.length,
    parsed: 0,
    failed: [],
    rejected: [],
    skipped: [],
    reindexed: [],
    tombstoned: [],
    chunksProduced: 0,
    sourceCount: sources.length,
    indexedCount: 0,
  };

  const existingFor = (documentId: string) => index.chunks.filter((chunk) => chunk.documentId === documentId);

  for (const source of sources) {
    // Garbage here is unfixable downstream, so it is named rather than skipped.
    if (!source.parseOk) {
      manifest.failed.push({ documentId: source.documentId, reason: source.parseError as string });
      chunks.push(...existingFor(source.documentId));
      continue;
    }
    manifest.parsed += 1;

    const missing = config.requiredMetadata.filter((field) => {
      const value = source[field as 'tenantId' | 'version'];
      return value === null || value === undefined || value === '';
    });
    // A document that cannot be assigned a tenant fails ingestion. It is never indexed untagged.
    if (missing.length > 0) {
      manifest.rejected.push({
        documentId: source.documentId,
        reason: `missing required metadata: ${missing.join(', ')}`,
      });
      chunks.push(...existingFor(source.documentId));
      continue;
    }

    const existing = existingFor(source.documentId);
    // Hash the content. A timestamp moves for reasons unrelated to what the document says.
    const unchanged =
      existing.length > 0 &&
      existing.every(
        (chunk) => chunk.contentHash === source.contentHash && chunk.pipelineVersion === config.pipelineVersion,
      );

    if (unchanged) {
      manifest.skipped.push(source.documentId);
      chunks.push(...existing);
      continue;
    }

    manifest.reindexed.push(source.documentId);
    for (let position = 0; position < source.chunkCount; position += 1) {
      // Deterministic identity, so a re-run replaces rather than duplicates.
      chunks.push({
        id: `${source.documentId}#${position}`,
        documentId: source.documentId,
        version: source.version as number,
        tenantId: source.tenantId as string,
        contentHash: source.contentHash,
        pipelineVersion: config.pipelineVersion,
      });
      manifest.chunksProduced += 1;
    }
  }

  // Nothing iterates over what no longer exists unless you write this part.
  const present = new Set(sources.map((source) => source.documentId));
  for (const chunk of index.chunks) {
    if (!present.has(chunk.documentId) && !manifest.tombstoned.includes(chunk.documentId)) {
      manifest.tombstoned.push(chunk.documentId);
    }
  }

  manifest.indexedCount = chunks.length;
  return { chunks, manifest };
}
