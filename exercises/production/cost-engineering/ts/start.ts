import { Unimplemented } from '#harness';

export interface Plan {
  systemTokens: number;
  toolsTokens: number;
  perTurnTokens: number;
  outputTokens: number;
  maxTurns: number;
  compactionCap: number;
}

export interface Budget {
  capMicros: number;
  softRatioBps: number;
}

export interface Prices {
  inputMicrosPerToken: number;
  outputMicrosPerToken: number;
  degradedInputMicrosPerToken: number;
  degradedOutputMicrosPerToken: number;
}

export interface Executed {
  turns: Array<{ index: number; contextTokens: number; costMicros: number; action: string }>;
  spentMicros: number;
  inputMicros: number;
  outputMicros: number;
  outcome: 'completed' | 'stopped';
}

export function run(plan: Plan, budget: Budget, prices: Prices): Executed {
  throw new Unimplemented('run');
}
