export interface Run {
  id: string;
  stage: 'shadow' | 'canary' | 'production';
  escalated: boolean;
  retried: boolean;
  costOutlier: boolean;
  requestsWrite: boolean;
}

export interface Policy {
  baselineEveryNth: number;
  always: string[];
}

export interface Plan {
  scored: string[];
  rateBps: Record<string, number>;
  writes: { requested: number; validated: number; coverageBps: number; unvalidated: string[] };
}

const bps = (part: number, whole: number) => (whole === 0 ? 0 : Math.floor((part * 10000) / whole + 0.5));
const flagged = (run: Run, policy: Policy) => policy.always.some((name) => run[name as keyof Run] === true);

export function plan(runs: Run[], policy: Policy): Plan {
  // Systematic by position rather than random, so the same traffic yields the same plan.
  const isScored = (run: Run, index: number) => index % policy.baselineEveryNth === 0 || flagged(run, policy);
  const scored = runs.filter(isScored);

  const rateBps: Record<string, number> = { overall: bps(scored.length, runs.length) };

  const plain = runs.filter((run) => !flagged(run, policy));
  rateBps.plain = bps(plain.filter((run) => scored.includes(run)).length, plain.length);

  for (const name of policy.always) {
    const stratum = runs.filter((run) => run[name as keyof Run] === true);
    rateBps[name] = bps(stratum.filter((run) => scored.includes(run)).length, stratum.length);
  }

  // A shadowed agent runs with writes disabled, so a shadow write proves nothing.
  const requested = runs.filter((run) => run.requestsWrite);
  const unvalidated = requested.filter((run) => run.stage === 'shadow');
  const validated = requested.length - unvalidated.length;

  return {
    scored: scored.map((run) => run.id),
    rateBps,
    writes: {
      requested: requested.length,
      validated,
      coverageBps: bps(validated, requested.length),
      unvalidated: unvalidated.map((run) => run.id),
    },
  };
}
