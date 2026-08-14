import { Unimplemented } from '#harness';

export interface Step {
  hasSideEffect: boolean;
  needsResumption: boolean;
  observedSeparately: boolean;
  slow: boolean;
}

export interface Decision {
  verdict: 'node' | 'function';
  reasons: string[];
}

export function decide(_step: Step): Decision {
  throw new Unimplemented('decide');
}
