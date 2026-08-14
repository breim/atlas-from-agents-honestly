import { Unimplemented } from '#harness';

export interface Case {
  id: string;
  route: string;
  bucket: 'production' | 'adversarial' | 'constructed' | 'replay';
  origin: 'harvested' | 'synthetic';
  generatedBy: string | null;
  labels: string[];
  containsPii: boolean;
  redacted: boolean;
  ageDays: number;
}

export interface Policy {
  maxPerRoute: number;
  requiredBuckets: string[];
  minKappaBps: number;
  evaluatedFamily: string;
  productionFreshnessDays: number;
  rubricsPerCase: number;
  judgeCallBudget: number;
}

export interface RouteReport {
  route: string;
  size: number;
  buckets: Record<string, number>;
  kappaBps: number;
  judgeCalls: number;
  sampled: boolean;
  errors: string[];
  warnings: string[];
}

export interface Report {
  status: 'usable' | 'unusable';
  routes: RouteReport[];
}

export function assess(cases: Case[], policy: Policy): Report {
  throw new Unimplemented('assess');
}
