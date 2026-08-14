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

const TERMINAL = ['completed', 'failed', 'escalated'];

export function check(run: Run, caps: Caps): Report {
  // Six promises, always the same six, so a violation names which one broke.
  // Nothing here reads answerCorrect: the semantic class has no signal to assert on.
  const invariants: Array<[string, boolean]> = [
    ['terminal', TERMINAL.includes(run.terminalState)],
    ['no_duplicate', run.effects.every((effect) => effect.count <= 1)],
    ['bounded', run.costCents <= caps.costCents && run.turns <= caps.turns],
    [
      'escalated',
      !run.unresolved || (run.terminalState === 'escalated' && run.escalationReason !== null),
    ],
    ['traceable', run.trace.injectedFault !== null && run.trace.recoveryRecorded],
    [
      'contained',
      run.boundaries.tenantPropagated && run.boundaries.taintHeld && run.boundaries.authorized,
    ],
  ];

  const violations = invariants.filter(([, held]) => !held).map(([name]) => name);

  return {
    violations,
    held: invariants.filter(([, held]) => held).map(([name]) => name),
    passed: violations.length === 0,
  };
}
