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
  const prefix = plan.systemTokens + plan.toolsTokens;
  const soft = Math.floor((budget.capMicros * budget.softRatioBps) / 10000);

  const turns: Executed['turns'] = [];
  let spentMicros = 0;
  let inputMicros = 0;
  let outputMicros = 0;

  for (let index = 1; index <= plan.maxTurns; index += 1) {
    // The whole transcript is re-sent, unless compaction caps what carries forward.
    const grown = prefix + (index - 1) * plan.perTurnTokens;
    const contextTokens = plan.compactionCap > 0 ? Math.min(grown, plan.compactionCap) : grown;

    // Degrade before failing: cheaper rates buy turns a hard stop would have refused.
    const degrading = spentMicros > soft;
    const inputRate = degrading ? prices.degradedInputMicrosPerToken : prices.inputMicrosPerToken;
    const outputRate = degrading ? prices.degradedOutputMicrosPerToken : prices.outputMicrosPerToken;

    const input = contextTokens * inputRate;
    const output = plan.outputTokens * outputRate;
    const costMicros = input + output;

    // A turn that does not fit is not taken, and is not billed.
    if (spentMicros + costMicros > budget.capMicros) {
      return { turns, spentMicros, inputMicros, outputMicros, outcome: 'stopped' };
    }

    spentMicros += costMicros;
    inputMicros += input;
    outputMicros += output;
    turns.push({ index, contextTokens, costMicros, action: degrading ? 'degrade' : 'proceed' });
  }

  return { turns, spentMicros, inputMicros, outputMicros, outcome: 'completed' };
}
