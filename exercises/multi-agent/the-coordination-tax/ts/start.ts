import { Unimplemented } from '#harness';

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

export function price(topology: Topology, baseline: Baseline, config: Config): Priced {
  throw new Unimplemented('price');
}
