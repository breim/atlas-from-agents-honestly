import { Unimplemented } from '#harness';

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

export function remember(request: Request, store: Store, policy: Policy, now: number): Memory {
  throw new Unimplemented('remember');
}
