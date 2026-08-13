import { Unimplemented } from '#harness';

export interface Policy {
  baseline: number;
  tolerance: number;
  minSamples: number;
}

export interface Decision {
  action: 'promote' | 'hold' | 'rollback';
  reason: string;
}

export function decide(_samples: number, _rate: number, _policy: Policy): Decision {
  throw new Unimplemented('decide');
}
