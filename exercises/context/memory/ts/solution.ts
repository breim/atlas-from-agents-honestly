export interface Fact {
  id: string;
  tenantId: string;
  subject: string;
  predicate: string;
  value: string;
  source: string | null;
  assertedBy: string;
  assertedOnDay: number;
  supersedes: string | null;
}

export interface Store {
  facts: Fact[];
}

export interface Policy {
  authorityRank: Record<string, number>;
  ttlDays: Record<string, number>;
  defaultTtlDays: number;
  secretPredicates: string[];
}

export interface Request {
  tenantId: string;
  subject: string;
  reads: string[];
  writes: Fact[];
}

export interface Recalled {
  predicate: string;
  value: string | null;
  source: string | null;
  assertedBy: string | null;
  assertedOnDay: number | null;
  ageDays: number | null;
  stale: boolean;
}

export interface Memory {
  recalled: Recalled[];
  admitted: string[];
  rejected: Array<{ id: string; reason: string }>;
}

const authorityOf = (assertedBy: string) => assertedBy.split(':')[0];

function refuse(write: Fact, policy: Policy): string | null {
  // Memories are replayed verbatim into every future context that loads them.
  if (policy.secretPredicates.includes(write.predicate)) return 'a secret never belongs in a memory store';
  if (!write.source) return 'a fact without provenance is not a fact';
  // Conclusions belong to a run, not to the record of what is true about an entity.
  if (authorityOf(write.assertedBy) === 'model') return 'a model inference is a conclusion, not a fact';
  return null;
}

export function remember(request: Request, store: Store, policy: Policy, now: number): Memory {
  const admitted: string[] = [];
  const rejected: Array<{ id: string; reason: string }> = [];

  for (const write of request.writes) {
    const reason = refuse(write, policy);
    if (reason) rejected.push({ id: write.id, reason });
    else admitted.push(write.id);
  }

  const facts = [...store.facts, ...request.writes.filter((write) => admitted.includes(write.id))];
  // Append-only is the trap: the retired version is retired explicitly, not merely older.
  const retired = new Set(facts.map((fact) => fact.supersedes).filter((id): id is string => id !== null));

  const recalled = request.reads.map((predicate) => {
    const candidates = facts.filter(
      (fact) =>
        fact.tenantId === request.tenantId &&
        fact.subject === request.subject &&
        fact.predicate === predicate &&
        !retired.has(fact.id),
    );

    // Highest authority first, then most recent. Never the other way round.
    const winner = candidates.reduce<Fact | null>((best, fact) => {
      if (!best) return fact;
      const rank = policy.authorityRank[authorityOf(fact.assertedBy)];
      const bestRank = policy.authorityRank[authorityOf(best.assertedBy)];
      if (rank !== bestRank) return rank > bestRank ? fact : best;
      return fact.assertedOnDay > best.assertedOnDay ? fact : best;
    }, null);

    if (!winner) {
      return { predicate, value: null, source: null, assertedBy: null, assertedOnDay: null, ageDays: null, stale: false };
    }

    const ageDays = now - winner.assertedOnDay;
    const ttl = policy.ttlDays[predicate] ?? policy.defaultTtlDays;
    return {
      predicate,
      value: winner.value,
      source: winner.source,
      assertedBy: winner.assertedBy,
      assertedOnDay: winner.assertedOnDay,
      ageDays,
      // Expiry does not delete. It surfaces the fact with its age.
      stale: ageDays > ttl,
    };
  });

  return { recalled, admitted, rejected };
}
