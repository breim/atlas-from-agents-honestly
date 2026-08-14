export interface Rollout {
  changedFields: string[];
  previousIndexRetained: boolean;
  canaryDays: number;
  canaryReviewedBy: 'dashboards' | 'reading-outputs';
}

export interface Signal {
  name: string;
  kind: 'definition' | 'implementation';
  moved: boolean;
}

export interface Incident {
  breakerOpened: boolean;
  retriesStopped: boolean;
  fallbackServed: boolean;
  tierOneAutoGated: boolean;
  canaryConfirmedNotUs: boolean;
  probeClosedIt: boolean;
  humanConsequenceInjected: boolean;
}

export interface Drift {
  queriesRun: string[];
}

export interface Ledger {
  claimed: number;
  hit: number;
  missesReported: number;
  structuralMisses: number;
  knownCauseMisses: number;
}

export interface Policy {
  maxChangedFields: number;
  minCanaryDays: number;
  driftQueries: string[];
  incidentSteps: string[];
}

export interface Report {
  status: 'operable' | 'not-operable';
  errors: string[];
  warnings: string[];
  reversibleInSeconds: boolean;
  driftMinutes: number | null;
  ledgerHonest: boolean;
}

export function operate(
  rollout: Rollout,
  signals: Signal[],
  incident: Incident,
  drift: Drift,
  ledger: Ledger,
  policy: Policy,
): Report {
  const errors: string[] = [];
  const warnings: string[] = [];

  // A good rollout is anticlimactic: one number in a manifest, reversible in seconds.
  if (rollout.changedFields.length > policy.maxChangedFields) {
    errors.push(`${rollout.changedFields.length} fields changed; a rollout is one number in a manifest`);
  }
  // Retaining the previous build turns an eleven-minute fix into an available option.
  const reversibleInSeconds = rollout.previousIndexRetained && rollout.changedFields.length <= policy.maxChangedFields;
  if (!rollout.previousIndexRetained) errors.push('the previous index build was not retained, so there is nothing to roll back to');

  // Week one of a canary is for reading outputs, not dashboards.
  if (rollout.canaryDays < policy.minCanaryDays) errors.push(`a ${rollout.canaryDays}-day canary is too short to read`);
  if (rollout.canaryReviewedBy !== 'reading-outputs') {
    errors.push('the canary was reviewed on dashboards rather than by reading outputs');
  }

  // The metric that surprises you first is usually the one whose definition was wrong.
  for (const signal of signals) {
    if (signal.moved && signal.kind === 'definition') {
      warnings.push(`${signal.name} moved because its definition was wrong, not its implementation`);
    }
  }

  // A well-handled incident is unremarkable, and every step has to be there.
  const incidentRecord = incident as unknown as Record<string, boolean>;
  for (const step of policy.incidentSteps) {
    if (!incidentRecord[step]) errors.push(`the incident response never ${step}`);
  }
  // Inject the human consequence, not just the technical fault.
  if (!incident.humanConsequenceInjected) {
    errors.push('the drill injected the technical fault and not the human consequence');
  }

  // Drift diagnosis is four queries, and nine minutes when each is already instrumented.
  const missing = policy.driftQueries.filter((query) => !drift.queriesRun.includes(query));
  for (const query of missing) errors.push(`drift diagnosis has no ${query} query`);
  const driftMinutes = missing.length === 0 ? policy.driftQueries.length * 2 + 1 : null;

  // Report the ledger honestly, including the misses.
  const misses = ledger.claimed - ledger.hit;
  const ledgerHonest =
    ledger.missesReported === misses && ledger.structuralMisses + ledger.knownCauseMisses === misses;
  if (!ledgerHonest) errors.push('the ledger does not report every miss, separated by cause');

  return {
    status: errors.length > 0 ? 'not-operable' : 'operable',
    errors,
    warnings,
    reversibleInSeconds,
    driftMinutes,
    ledgerHonest,
  };
}
