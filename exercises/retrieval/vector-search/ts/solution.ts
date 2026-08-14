export interface Chunk {
  id: number;
  documentId: string;
  version: number;
  supersededAt: string | null;
  tier: string;
  region: string;
  tenantId: string;
  embedding: number;
}

export interface Index {
  probe: number;
  chunks: Chunk[];
  strategy: 'post' | 'pre' | 'in-algorithm';
}

export interface Query {
  point: number;
}

export type Filters = Partial<Pick<Chunk, 'tier' | 'region' | 'tenantId'>>;

export interface Hit {
  id: number;
  documentId: string;
  version: number;
  distance: number;
}

export interface Search {
  strategy: Index['strategy'];
  results: Hit[];
  scanned: number;
  filtered: number;
  shortfall: number;
}

const distanceOf = (chunk: Chunk, query: Query) => Math.abs(chunk.embedding - query.point);

// Similarity only orders. Ties break on id so the ordering is total.
const byDistance = (query: Query) => (left: Chunk, right: Chunk) =>
  distanceOf(left, query) - distanceOf(right, query) || left.id - right.id;

function matches(chunk: Chunk, filters: Filters): boolean {
  // Not optional and not a ranking signal: the current-version rule holds whatever was asked.
  if (chunk.supersededAt !== null) return false;
  if (filters.tier !== undefined && chunk.tier !== filters.tier) return false;
  if (filters.region !== undefined && chunk.region !== filters.region) return false;
  if (filters.tenantId !== undefined && chunk.tenantId !== filters.tenantId) return false;
  return true;
}

const hitOf = (chunk: Chunk, query: Query): Hit => ({
  id: chunk.id,
  documentId: chunk.documentId,
  version: chunk.version,
  distance: distanceOf(chunk, query),
});

export function search(query: Query, filters: Filters, k: number, index: Index): Search {
  const ordered = [...index.chunks].sort(byDistance(query));
  const matching = ordered.filter((chunk) => matches(chunk, filters));

  let results: Hit[];
  let scanned: number;

  if (index.strategy === 'post') {
    // Search the whole index, then discard. What survives is whatever happened to be near.
    scanned = index.chunks.length;
    results = ordered
      .slice(0, index.probe)
      .filter((chunk) => matches(chunk, filters))
      .slice(0, k)
      .map((chunk) => hitOf(chunk, query));
  } else {
    results = matching.slice(0, k).map((chunk) => hitOf(chunk, query));
    // Pre-filtering computes a distance for every member; the graph walk prunes instead.
    scanned = index.strategy === 'pre' ? matching.length : Math.min(matching.length, index.probe);
  }

  return {
    strategy: index.strategy,
    results,
    scanned,
    filtered: matching.length,
    shortfall: k - results.length,
  };
}
