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

export function audit(suite: Suite, policy: Policy, question: 'did-it-change' | 'how-good-is-it'): Verdict {
  const errors: string[] = [];

  // One configuration for both questions makes a suite flaky and blind at once.
  if (question === 'did-it-change' && suite.configuration !== 'tightest') {
    errors.push('did-it-change needs the tightest configuration the model accepts');
  }
  if (question === 'how-good-is-it') {
    if (suite.configuration !== 'production') {
      errors.push('a quality claim measured off production settings is about a system nobody runs');
    }
    if (suite.seeds < 2) errors.push('a quality claim from one seed has no variance to report');
  }

  // Declared in advance is a design; chosen after seeing red is p-hacking.
  if (suite.rerunPolicy === 'undeclared') errors.push('the re-run policy is not declared in advance');

  // Decide the regression size that matters, then derive the set size.
  const sizes = Object.entries(policy.detectableAt)
    .map(([points, needed]) => ({ points: Number(points), needed }))
    .sort((left, right) => left.points - right.points);
  const reachable = sizes.find((entry) => suite.casesPerArm >= entry.needed);
  const detectablePoints = reachable ? reachable.points : null;

  const gated: string[] = [];
  const reported: string[] = [];

  for (const criterion of suite.criteria) {
    if (!criterion.gated) {
      reported.push(criterion.name);
      continue;
    }
    // A deterministic assertion has no sampling error, so it gates at any set size.
    if (criterion.kind === 'deterministic') {
      gated.push(criterion.name);
      continue;
    }
    if (detectablePoints === null || criterion.observedDropPoints < detectablePoints) {
      errors.push(
        `${criterion.name} gates on ${criterion.observedDropPoints} points, below what ${suite.casesPerArm} cases can detect`,
      );
      continue;
    }
    gated.push(criterion.name);
  }

  // Sixty binary criteria gated individually produce false alarms by construction.
  const judgedGates = suite.criteria.filter((item) => item.gated && item.kind === 'judged').length;
  const expectedFalseAlarmsBps = judgedGates * policy.falseAlarmBps;
  if (expectedFalseAlarmsBps > policy.flakeBudgetBps) {
    errors.push(
      `gating ${judgedGates} judged criteria individually spends ${expectedFalseAlarmsBps} bps against a budget of ${policy.flakeBudgetBps}`,
    );
  }

  return {
    status: errors.length > 0 ? 'unsound' : 'sound',
    errors,
    detectablePoints,
    gated,
    reported,
    expectedFalseAlarmsBps,
  };
}
