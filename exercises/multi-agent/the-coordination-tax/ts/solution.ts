export interface Agent {
  name: string;
  prefixTokens: number;
  turns: number;
  outputPerTurn: number;
  inboundSummaryTokens: number;
  outboundSummaryTokens: number;
}

export interface Topology {
  agents: Agent[];
  parallel: boolean;
  isolationRequired: boolean;
  taskValueMicros: number;
}

export interface Baseline {
  prefixTokens: number;
  turns: number;
  outputPerTurn: number;
}

export interface Config {
  inputMicrosPerToken: number;
  outputMicrosPerToken: number;
  turnMs: number;
  rampUpMs: number;
}

export interface Priced {
  perAgent: Array<{ name: string; inputTokens: number; outputTokens: number }>;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costMicros: number;
  baselineTokens: number;
  multiplierBps: number;
  latencyMs: number;
  worthIt: boolean;
  reasons: string[];
}

// The transcript is re-sent every turn, so each agent runs its own quadratic.
const loop = (prefix: number, turns: number, perTurn: number) =>
  turns * prefix + perTurn * ((turns * (turns - 1)) / 2);

export function price(topology: Topology, baseline: Baseline, config: Config): Priced {
  const perAgent = topology.agents.map((agent) => ({
    name: agent.name,
    // The inbound summary joins the prefix, so it is re-read on every turn.
    inputTokens: loop(agent.prefixTokens + agent.inboundSummaryTokens, agent.turns, agent.outputPerTurn),
    // The outbound summary is written once.
    outputTokens: agent.turns * agent.outputPerTurn + agent.outboundSummaryTokens,
  }));

  const inputTokens = perAgent.reduce((sum, agent) => sum + agent.inputTokens, 0);
  const outputTokens = perAgent.reduce((sum, agent) => sum + agent.outputTokens, 0);
  const totalTokens = inputTokens + outputTokens;

  const baselineTokens =
    loop(baseline.prefixTokens, baseline.turns, baseline.outputPerTurn) + baseline.turns * baseline.outputPerTurn;

  const spans = topology.agents.map((agent) => config.rampUpMs + agent.turns * config.turnMs);
  // The one refund: independent work finishes in the time of the slowest.
  const latencyMs =
    spans.length === 0 ? 0 : topology.parallel ? Math.max(...spans) : spans.reduce((sum, span) => sum + span, 0);

  const costMicros = inputTokens * config.inputMicrosPerToken + outputTokens * config.outputMicrosPerToken;

  // A single agent has no coordination tax to justify.
  const reasons: string[] = [];
  if (topology.agents.length > 1) {
    if (topology.taskValueMicros < costMicros) reasons.push('value_below_cost');
    if (!topology.parallel && !topology.isolationRequired) reasons.push('not_parallel_and_no_isolation');
  }

  return {
    perAgent,
    inputTokens,
    outputTokens,
    totalTokens,
    costMicros,
    baselineTokens,
    multiplierBps: baselineTokens === 0 ? 0 : Math.floor((totalTokens * 10000) / baselineTokens + 0.5),
    latencyMs,
    worthIt: reasons.length === 0,
    reasons,
  };
}
