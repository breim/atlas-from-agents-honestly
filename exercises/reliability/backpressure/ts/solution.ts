export type Priority = 'interactive' | 'background' | 'batch';

export interface Run {
  priority: Priority;
  tenantId: string;
  estInputTokens: number;
}

export interface Used {
  byPriority: Record<Priority, number>;
  retriesByPriority: Record<Priority, number>;
  byTenant: Record<string, number>;
}

export interface Config {
  inputTpm: number;
  clientLimitBps: number;
  shareBps: Record<Priority, number>;
  tenantCapBps: number;
  backoffMs: Record<Priority, number>;
  tenantBackoffMs: number;
  profile: { avgContextTokens: number; turnsPerMinute: number };
}

export interface Admission {
  admitted: boolean;
  reason: string | null;
  retryAfterMs: number;
  classBudget: number;
  tenantCap: number;
  headroom: number;
  effectiveConcurrentRuns: number;
}

export function admit(run: Run, used: Used, config: Config): Admission {
  // Sized below the provider's, so load is shed deliberately and a 429 is an alert.
  const effective = Math.floor((config.inputTpm * config.clientLimitBps) / 10000);
  const classBudget = Math.floor((effective * config.shareBps[run.priority]) / 10000);
  const tenantCap = Math.floor((effective * config.tenantCapBps) / 10000);

  const perMinute = config.profile.avgContextTokens * config.profile.turnsPerMinute;
  const effectiveConcurrentRuns = perMinute === 0 ? 0 : Math.floor(effective / perMinute);

  // Retries were generated inside runs already admitted. They bypass the door unless
  // they are counted here.
  const spent = used.byPriority[run.priority] + used.retriesByPriority[run.priority];
  const headroom = classBudget - spent;

  const shared = { classBudget, tenantCap, headroom, effectiveConcurrentRuns };

  if (spent + run.estInputTokens > classBudget) {
    return { admitted: false, reason: 'class_budget', retryAfterMs: config.backoffMs[run.priority], ...shared };
  }

  const tenant = used.byTenant[run.tenantId] ?? 0;
  if (tenant + run.estInputTokens > tenantCap) {
    return { admitted: false, reason: 'tenant_cap', retryAfterMs: config.tenantBackoffMs, ...shared };
  }

  return { admitted: true, reason: null, retryAfterMs: 0, ...shared };
}
