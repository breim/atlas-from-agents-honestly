export interface Gate {
  position: 'plan' | 'execution' | 'output' | 'exception';
  sideEffects: string[];
  disclose: string[];
  answers: string[];
  expiresAfterMs: number;
  lane: 'fast' | 'deliberate';
}

export interface Decision {
  answer: string;
  atMs: number;
  reason?: string;
  edit?: string;
}

export interface Policy {
  required: string[];
  laneBudgetMs: Record<string, number>;
  volatilityMs: number;
}

export interface Verdict {
  status: 'accepted' | 'rejected' | 'invalid';
  errors: string[];
  next: 'act' | 'revise' | 'halt' | 'none';
  applied: string | null;
  staleBy: number;
}

export function gate(spec: Gate, decision: Decision, presentedAtMs: number, policy: Policy): Verdict {
  const errors: string[] = [];

  // Resume re-executes the node from the top, so a gate holds exactly one side-effecting call.
  if (spec.sideEffects.length !== 1) {
    errors.push(`a gate node holds one side-effecting call, not ${spec.sideEffects.length}`);
  }

  // Hide a material fact and you have added latency without oversight.
  for (const field of policy.required) {
    if (!spec.disclose.includes(field)) errors.push(`the reviewer is not shown ${field}`);
  }

  // Four answers, not two. Edit is the one reviewers actually want.
  for (const answer of ['approve', 'deny', 'edit', 'escalate']) {
    if (!spec.answers.includes(answer)) errors.push(`the gate does not accept ${answer}`);
  }

  // An approval is a decision about a state, and the state moves.
  if (spec.expiresAfterMs > policy.volatilityMs) {
    errors.push(`expiry of ${spec.expiresAfterMs}ms outlives data that moves every ${policy.volatilityMs}ms`);
  }

  if (spec.lane === 'fast' && spec.position === 'execution') {
    errors.push('an execution gate belongs in the deliberate lane');
  }

  if (errors.length > 0) {
    return { status: 'invalid', errors, next: 'none', applied: null, staleBy: 0 };
  }

  const age = decision.atMs - presentedAtMs;
  const staleBy = Math.max(0, age - spec.expiresAfterMs);
  if (staleBy > 0) {
    // An update, not a signal: staleness is rejected before it is recorded.
    return { status: 'rejected', errors: [`the decision is ${staleBy}ms past its validity`], next: 'revise', applied: null, staleBy };
  }

  if (!spec.answers.includes(decision.answer)) {
    return { status: 'rejected', errors: [`${decision.answer} is not an answer this gate accepts`], next: 'none', applied: null, staleBy: 0 };
  }

  if (decision.answer === 'deny' && !decision.reason) {
    return { status: 'rejected', errors: ['a denial without a reason is not an instruction'], next: 'none', applied: null, staleBy: 0 };
  }

  if (decision.answer === 'edit' && !decision.edit) {
    return { status: 'rejected', errors: ['an edit without a correction is a denial'], next: 'none', applied: null, staleBy: 0 };
  }

  const next =
    decision.answer === 'approve' ? 'act' : decision.answer === 'edit' ? 'act' : decision.answer === 'deny' ? 'revise' : 'halt';

  return {
    status: 'accepted',
    errors: [],
    // The deny path is a branch, not an end state.
    next,
    applied: decision.answer === 'edit' ? (decision.edit as string) : decision.answer === 'approve' ? spec.sideEffects[0] : null,
    staleBy: 0,
  };
}
