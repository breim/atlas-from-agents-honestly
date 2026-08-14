import { Unimplemented } from '#harness';

export interface Criterion {
  name: string;
  kind: 'invariant' | 'rate';
  gated: boolean;
  threshold: number | null;
}

export interface Dataset {
  handLabelled: number;
  promotedFailures: number;
  adversarial: number;
  negatives: number;
}

export interface Suite {
  dataset: Dataset;
  criteria: Criterion[];
  traceFields: string[];
  injections: string[];
  reviewedAgainst: 'design' | 'built-system';
}

export interface Policy {
  requiredSources: string[];
  requiredTraceFields: string[];
  requiredInjections: string[];
  flakeBudgetBps: number;
  rateFalseAlarmBps: number;
}

export interface Report {
  status: 'hardened' | 'soft';
  errors: string[];
  gated: string[];
  reported: string[];
  flakeSpendBps: number;
  datasetSize: number;
}

export function harden(suite: Suite, policy: Policy): Report {
  throw new Unimplemented('harden');
}
