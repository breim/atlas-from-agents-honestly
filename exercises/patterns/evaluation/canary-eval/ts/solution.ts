export interface Policy {
  baseline: number;
  tolerance: number;
  minSamples: number;
}

export interface Decision {
  action: 'promote' | 'hold' | 'rollback';
  reason: string;
}

export function decide(samples: number, rate: number, policy: Policy): Decision {
  if (samples < policy.minSamples) return { action: 'hold', reason: 'insufficient_samples' };
  if (rate >= policy.baseline) return { action: 'promote', reason: 'at_or_above_baseline' };
  if (rate >= policy.baseline - policy.tolerance) {
    return { action: 'hold', reason: 'within_tolerance' };
  }

  return { action: 'rollback', reason: 'below_tolerance' };
}
