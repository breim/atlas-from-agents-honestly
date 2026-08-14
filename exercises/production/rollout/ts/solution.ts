export interface Rollout {
  id: string;
  stable: string;
  candidate: string;
  canaryFractionBps: number;
  holdout: string[];
  policyVersion: string;
}

export interface Request {
  tenantId: string;
  bucketBps: number;
  resuming: boolean;
  pinnedBundleId: string | null;
  pinnedPolicyVersion: string | null;
}

export interface Assignment {
  bundleId: string;
  reason: string;
  policyVersion: string;
}

const MIGRATES: Record<string, string> = {
  bugfix: 'migrated_bug_fix',
  policy: 'policy_applies_today',
};

export function assign(request: Request, rollout: Rollout, change: string): Assignment {
  // Never pinned. A run that paused on Tuesday acts under Thursday's rules.
  const policyVersion = rollout.policyVersion;

  if (request.resuming) {
    const migrated = MIGRATES[change];
    // A quality improvement keeps the bundle the run was half-decided under.
    return migrated
      ? { bundleId: rollout.candidate, reason: migrated, policyVersion }
      : { bundleId: request.pinnedBundleId!, reason: 'pinned_at_start', policyVersion };
  }

  if (rollout.holdout.includes(request.tenantId)) {
    return { bundleId: rollout.stable, reason: 'holdout', policyVersion };
  }

  // Sticky by tenant, so behaviour is consistent and the comparison is clean.
  return request.bucketBps < rollout.canaryFractionBps
    ? { bundleId: rollout.candidate, reason: 'canary', policyVersion }
    : { bundleId: rollout.stable, reason: 'stable', policyVersion };
}
