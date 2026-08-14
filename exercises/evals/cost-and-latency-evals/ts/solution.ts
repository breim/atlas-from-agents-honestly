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

const per = (total: number, count: number) => (count === 0 ? null : Math.floor(total / count + 0.5));
const bps = (part: number, whole: number) => (whole === 0 ? 0 : Math.floor((part * 10000) / whole + 0.5));

const p95 = (values: number[]) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil((95 * sorted.length) / 100) - 1];
};

const within = (measured: number | null, budget: number) => measured === null || measured <= budget;

export function evaluate(runs: Run[], config: Config): Report {
  // Every cent on top; only the runs that bought something on the bottom.
  const spend = runs.reduce((sum, run) => sum + run.costCents, 0);
  const resolved = runs.filter((run) => run.outcome === 'resolved').length;

  // A three-day approval is the system working, not latency.
  const measured = runs.map((run) => run.totalMs - run.humanWaitMs);

  const costPerOutcomeCents = per(spend, resolved);
  const ttftP95Ms = p95(runs.map((run) => run.ttftMs));
  const totalP95Ms = p95(measured);
  const overCeilingBps = bps(measured.filter((ms) => ms > config.budgets.hardCeilingMs).length, runs.length);

  const resolvedRateBps = bps(resolved, runs.length);
  const quality = resolvedRateBps >= config.baseline.resolvedRateBps - config.noiseBandBps;
  const cost =
    costPerOutcomeCents !== null &&
    costPerOutcomeCents <= Math.floor((config.baseline.costPerOutcomeCents * 110) / 100);
  const latency =
    within(ttftP95Ms, config.budgets.ttftP95Ms) &&
    within(totalP95Ms, config.budgets.totalP95Ms) &&
    overCeilingBps <= config.budgets.overCeilingBps;

  return {
    resolvedRateBps,
    costPerOutcomeCents,
    costPerAttemptCents: per(spend, runs.length),
    ttftP95Ms,
    totalP95Ms,
    overCeilingBps,
    gates: { quality, cost, latency, pass: quality && cost && latency },
  };
}
