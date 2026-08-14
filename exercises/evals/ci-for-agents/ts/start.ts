import { Unimplemented } from '#harness';

export interface Criterion {
  name: string;
  kind: 'deterministic' | 'judged';
  gated: boolean;
  observedDropPoints: number;
}

export interface Suite {
  casesPerArm: number;
  criteria: Criterion[];
  configuration: 'tightest' | 'production';
  seeds: number;
  rerunPolicy: 'declared-best-of-three' | 'declared-single' | 'undeclared';
}

export interface Policy {
  detectableAt: Record<string, number>;
  falseAlarmBps: number;
  flakeBudgetBps: number;
}

export interface Verdict {
  status: 'sound' | 'unsound';
  errors: string[];
  detectablePoints: number | null;
  gated: string[];
  reported: string[];
  expectedFalseAlarmsBps: number;
}

export function audit(
  suite: Suite,
  policy: Policy,
  question: 'did-it-change' | 'how-good-is-it',
): Verdict {
  throw new Unimplemented('audit');
}
