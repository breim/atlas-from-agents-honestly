export interface Request {
  at: number;
  prefix: string;
  prefixTokens: number;
}

export interface Replay {
  hits: number[];
  misses: number[];
  hitRateBps: number;
}

export function replay(requests: Request[], minCacheTokens: number, ttlMs: number): Replay {
  const hits: number[] = [];
  const misses: number[] = [];
  let entry: { prefix: string; lastUsed: number } | null = null;

  for (const [index, request] of requests.entries()) {
    if (request.prefixTokens < minCacheTokens) {
      misses.push(index);
      continue;
    }

    const live = entry !== null && entry.prefix === request.prefix && request.at - entry.lastUsed < ttlMs;
    (live ? hits : misses).push(index);
    entry = { prefix: request.prefix, lastUsed: request.at };
  }

  const hitRateBps =
    requests.length === 0 ? 0 : Math.floor((hits.length * 10000) / requests.length + 0.5);

  return { hits, misses, hitRateBps };
}
