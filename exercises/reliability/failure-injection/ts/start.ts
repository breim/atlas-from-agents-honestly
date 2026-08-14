import { Unimplemented } from '#harness';

export interface Run {
  terminalState: string;
  effects: Array<{ name: string; count: number }>;
  costCents: number;
  turns: number;
  unresolved: boolean;
  escalationReason: string | null;
  trace: { injectedFault: string | null; recoveryRecorded: boolean };
  boundaries: { tenantPropagated: boolean; taintHeld: boolean; authorized: boolean };
  answerCorrect: boolean;
}

export interface Caps {
  costCents: number;
  turns: number;
}

export interface Report {
  violations: string[];
  held: string[];
  passed: boolean;
}

export function check(run: Run, caps: Caps): Report {
  throw new Unimplemented('check');
}
