import { Unimplemented } from '#harness';

export interface Run {
  outcome: 'resolved' | 'escalated' | 'abandoned';
  costCents: number;
  ttftMs: number;
  totalMs: number;
  humanWaitMs: number;
}

export interface Config {
  budgets: {
    ttftP95Ms: number;
    totalP95Ms: number;
    hardCeilingMs: number;
    overCeilingBps: number;
  };
  baseline: { resolvedRateBps: number; costPerOutcomeCents: number };
  noiseBandBps: number;
}

export interface Report {
  resolvedRateBps: number;
  costPerOutcomeCents: number | null;
  costPerAttemptCents: number | null;
  ttftP95Ms: number | null;
  totalP95Ms: number | null;
  overCeilingBps: number;
  gates: { quality: boolean; cost: boolean; latency: boolean; pass: boolean };
}

export function evaluate(runs: Run[], config: Config): Report {
  throw new Unimplemented('evaluate');
}
