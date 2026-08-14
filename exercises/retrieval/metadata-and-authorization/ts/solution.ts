export interface Chunk {
  id: number;
  documentId: string;
  version: number;
  tenantId: string | null;
  acl: string[];
  embedding: number;
  supersededAt: string | null;
}

export interface Index {
  probe: number;
  chunks: Chunk[];
  liveAcls: Record<string, string[]>;
}

export interface Principal {
  id: string;
  tenantId: string;
  groups: string[];
}

export interface Query {
  point: number;
  k: number;
  tenantId?: string;
}

export interface Config {
  enforcement: 'in-query' | 'post';
  lateBinding: boolean;
}

export interface Hit {
  id: number;
  documentId: string;
  version: number;
  distance: number;
}

export interface Retrieval {
  results: Hit[];
  exposed: string[];
  revoked: string[];
  audit: { principalId: string | null; tenantId: string | null; retrieved: string[] };
  errors: string[];
}

export function retrieve(query: Query, principal: Principal | null, index: Index, config: Config): Retrieval {
  // The principal is a required argument: not optional, not defaulted, not nullable.
  if (!principal) {
    return {
      results: [],
      exposed: [],
      revoked: [],
      audit: { principalId: null, tenantId: null, retrieved: [] },
      errors: ['retrieval requires a principal'],
    };
  }

  const distanceOf = (chunk: Chunk) => Math.abs(chunk.embedding - query.point);

  const authorized = (chunk: Chunk) =>
    chunk.supersededAt === null &&
    // Deny by default: a missing tenant tag is unreachable, never universally readable.
    chunk.tenantId !== null &&
    // The tenant comes from the principal. query.tenantId is never consulted.
    chunk.tenantId === principal.tenantId &&
    chunk.acl.some((group) => principal.groups.includes(group));

  const ordered = [...index.chunks].sort((left, right) => distanceOf(left) - distanceOf(right) || left.id - right.id);

  let candidates: Chunk[];
  const exposed: string[] = [];

  if (config.enforcement === 'post') {
    // Everything in the window was read out of storage, authorized or not.
    const window = ordered.slice(0, index.probe);
    for (const chunk of window) if (!authorized(chunk)) exposed.push(chunk.documentId);
    candidates = window.filter(authorized);
  } else {
    candidates = ordered.filter(authorized);
  }

  const revoked: string[] = [];
  const survivors = !config.lateBinding
    ? candidates
    : candidates.filter((chunk) => {
        // The indexed ACL is a copy. Verify each survivor against the live source.
        const live = index.liveAcls[chunk.documentId] ?? [];
        if (live.some((group) => principal.groups.includes(group))) return true;
        revoked.push(chunk.documentId);
        return false;
      });

  const results = survivors.slice(0, query.k).map((chunk) => ({
    id: chunk.id,
    documentId: chunk.documentId,
    version: chunk.version,
    distance: distanceOf(chunk),
  }));

  return {
    results,
    exposed,
    revoked,
    // Audit at the source. Generated prose cannot be audited after the fact.
    audit: {
      principalId: principal.id,
      tenantId: principal.tenantId,
      retrieved: results.map((hit) => hit.documentId),
    },
    errors: [],
  };
}
