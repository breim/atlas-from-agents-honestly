import { Unimplemented } from '#harness';

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

export function assign(request: Request, rollout: Rollout, change: string): Assignment {
  throw new Unimplemented('assign');
}
