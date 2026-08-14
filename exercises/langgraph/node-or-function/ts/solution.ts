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

/** Slowness is deliberately absent: it is a property of one run, not of replay. */
const GROUNDS: Array<[keyof Step, string]> = [
  ['hasSideEffect', 'side_effect'],
  ['needsResumption', 'resumption'],
  ['observedSeparately', 'observability'],
];

export function decide(step: Step): Decision {
  const reasons = GROUNDS.filter(([field]) => step[field]).map(([, reason]) => reason);

  return { verdict: reasons.length > 0 ? 'node' : 'function', reasons };
}
