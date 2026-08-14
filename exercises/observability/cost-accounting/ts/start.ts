import { Unimplemented } from '#harness';

export interface Call {
  id: string;
  runId: string;
  model: string;
  priceVersion: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  productive: boolean;
  synthetic: boolean;
}

export interface Rates {
  input: number;
  cachedInput: number;
  output: number;
}

export type Prices = Record<string, Record<string, Rates>>;

export interface Invoice {
  micros: number;
  toleranceBps: number;
}

export interface Ledger {
  priced: Array<{ id: string; costMicros: number }>;
  totals: { total: number; productive: number; unproductive: number; synthetic: number };
  cacheHitBps: number;
  runCostMicros: { p50: number | null; p90: number | null; p99: number | null; max: number | null };
  topRunsShareBps: number;
  reconciliation: { recordedMicros: number; gapBps: number; reconciles: boolean };
}

export function account(calls: Call[], prices: Prices, invoice: Invoice): Ledger {
  throw new Unimplemented('account');
}
