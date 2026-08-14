import { Unimplemented } from '#harness';

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
  throw new Unimplemented('admit');
}
