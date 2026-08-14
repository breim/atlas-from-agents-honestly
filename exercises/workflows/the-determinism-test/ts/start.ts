import { Unimplemented } from '#harness';

export interface Signals {
  stepsKnownUpfront: boolean;
  branchesEnumerable: boolean;
  needsJudgement: boolean;
}

export type Verdict = 'workflow' | 'workflow-with-model-steps' | 'agent';

export function classify(_signals: Signals): Verdict {
  throw new Unimplemented('classify');
}
