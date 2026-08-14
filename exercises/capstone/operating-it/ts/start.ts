import { Unimplemented } from '#harness';

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
  throw new Unimplemented('operate');
}
