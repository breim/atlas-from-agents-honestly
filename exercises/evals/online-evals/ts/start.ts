import { Unimplemented } from '#harness';

export interface Run {
  id: string;
  stage: 'shadow' | 'canary' | 'production';
  escalated: boolean;
  retried: boolean;
  costOutlier: boolean;
  requestsWrite: boolean;
}

export interface Policy {
  baselineEveryNth: number;
  always: string[];
}

export interface Plan {
  scored: string[];
  rateBps: Record<string, number>;
  writes: { requested: number; validated: number; coverageBps: number; unvalidated: string[] };
}

export function plan(runs: Run[], policy: Policy): Plan {
  throw new Unimplemented('plan');
}
