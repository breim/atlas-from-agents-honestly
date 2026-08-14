export interface Signals {
  stepsKnownUpfront: boolean;
  branchesEnumerable: boolean;
  needsJudgement: boolean;
}

export type Verdict = 'workflow' | 'workflow-with-model-steps' | 'agent';

export function classify(signals: Signals): Verdict {
  // Structure decides the shape; judgement only decides whether a model appears inside it.
  if (!signals.stepsKnownUpfront || !signals.branchesEnumerable) return 'agent';

  return signals.needsJudgement ? 'workflow-with-model-steps' : 'workflow';
}
