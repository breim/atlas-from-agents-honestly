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
  const errors: string[] = [];
  const dataset = suite.dataset as unknown as Record<string, number>;

  // Four sources, and the promoted-failure bucket grows at the rate the system breaks.
  for (const source of policy.requiredSources) {
    if (!dataset[source]) errors.push(`the dataset has no ${source} cases`);
  }

  const gated: string[] = [];
  const reported: string[] = [];
  let flakeSpendBps = 0;

  for (const criterion of suite.criteria) {
    if (!criterion.gated) {
      reported.push(criterion.name);
      continue;
    }
    if (criterion.kind === 'invariant') {
      // An invariant gates with no threshold; a threshold on one is a category error.
      if (criterion.threshold !== null) errors.push(`${criterion.name} is an invariant and carries a threshold`);
      gated.push(criterion.name);
      continue;
    }
    // A rate gated as if it were an invariant becomes something people re-run until it passes.
    errors.push(`${criterion.name} is a rate and is gated; report it as a distribution instead`);
  }

  for (const criterion of suite.criteria) {
    if (criterion.kind === 'rate' && criterion.gated) flakeSpendBps += policy.rateFalseAlarmBps;
  }
  if (flakeSpendBps > policy.flakeBudgetBps) {
    errors.push(`gated rates spend ${flakeSpendBps} bps against a budget of ${policy.flakeBudgetBps}`);
  }

  // Four trace fields are demanded by three chapters each; that redundancy is the signal.
  for (const field of policy.requiredTraceFields) {
    if (!suite.traceFields.includes(field)) errors.push(`the trace does not carry ${field}`);
  }

  for (const injection of policy.requiredInjections) {
    if (!suite.injections.includes(injection)) errors.push(`no injection covers ${injection}`);
  }

  // Run the security review against the built system, not the design.
  if (suite.reviewedAgainst !== 'built-system') {
    errors.push('the security review ran against the design rather than the built system');
  }

  return {
    status: errors.length > 0 ? 'soft' : 'hardened',
    errors,
    gated,
    reported,
    flakeSpendBps,
    datasetSize: Object.values(suite.dataset).reduce((total, value) => total + value, 0),
  };
}
