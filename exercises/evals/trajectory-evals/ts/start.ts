import { Unimplemented } from '#harness';

export interface Call {
  tool: string;
  args: string;
  error: string | null;
  contributed: boolean;
}

export interface Spec {
  required: string[];
  minimumSteps: number;
  orderPolicy: Array<[string, string]>;
}

export interface Trajectory {
  recallBps: number;
  precisionBps: number;
  stepEfficiencyBps: number;
  redundantBps: number;
  loopEscapeBps: number;
  policyViolations: string[];
}

export function score(calls: Call[], spec: Spec): Trajectory {
  throw new Unimplemented('score');
}
