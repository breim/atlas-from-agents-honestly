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

const bps = (part: number, whole: number) => (whole === 0 ? 0 : Math.floor((part * 10000) / whole + 0.5));

const rank = (sorted: number[], percentile: number) =>
  sorted.length === 0 ? null : sorted[Math.ceil((percentile * sorted.length) / 100) - 1];

export function account(calls: Call[], prices: Prices, invoice: Invoice): Ledger {
  // The version recorded on the call, not today's. History does not reprice itself.
  const cost = (call: Call) => {
    const rates = prices[call.priceVersion][call.model];
    return (
      call.inputTokens * rates.input +
      call.cachedInputTokens * rates.cachedInput +
      call.outputTokens * rates.output
    );
  };

  const priced = calls.map((call) => ({ id: call.id, costMicros: cost(call) }));
  const sum = (subset: Call[]) => subset.reduce((total, call) => total + cost(call), 0);

  const real = calls.filter((call) => !call.synthetic);
  const totals = {
    total: sum(calls),
    productive: sum(real.filter((call) => call.productive)),
    unproductive: sum(real.filter((call) => !call.productive)),
    synthetic: sum(calls.filter((call) => call.synthetic)),
  };

  const cached = real.reduce((tokens, call) => tokens + call.cachedInputTokens, 0);
  const uncached = real.reduce((tokens, call) => tokens + call.inputTokens, 0);

  // Heavy-tailed, and per run rather than per call, because a run is the unit that loops.
  const runs = [...new Set(real.map((call) => call.runId))].map((runId) =>
    sum(real.filter((call) => call.runId === runId)),
  );
  const sorted = [...runs].sort((a, b) => a - b);
  const spend = sorted.reduce((total, run) => total + run, 0);
  const top = sorted.slice(sorted.length - Math.ceil(sorted.length / 100));

  const gapBps =
    invoice.micros === 0
      ? totals.total === 0
        ? 0
        : 10000
      : bps(Math.abs(totals.total - invoice.micros), invoice.micros);

  return {
    priced,
    totals,
    cacheHitBps: bps(cached, cached + uncached),
    runCostMicros: {
      p50: rank(sorted, 50),
      p90: rank(sorted, 90),
      p99: rank(sorted, 99),
      max: rank(sorted, 100),
    },
    topRunsShareBps: bps(
      top.reduce((total, run) => total + run, 0),
      spend,
    ),
    reconciliation: { recordedMicros: totals.total, gapBps, reconciles: gapBps <= invoice.toleranceBps },
  };
}
