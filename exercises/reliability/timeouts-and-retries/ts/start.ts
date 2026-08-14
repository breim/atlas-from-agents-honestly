import { Unimplemented } from '#harness';

export interface Layer {
  name: string;
  attempts: number;
}

export interface Config {
  layers: Layer[];
  ownership: Record<string, string[]>;
  reserveBps: number;
  retryBudgetBps: number;
  maxAttemptsPerRun: number;
}

export interface Request {
  failureClass: string;
  preferredTimeoutMs: number;
  remainingMs: number;
  attemptsUsed: number;
  retriesInWindow: number;
  callsInWindow: number;
  modelRetries: number;
}

export interface Plan {
  layers: Layer[];
  totalCalls: number;
  multiplied: boolean;
  timeoutMs: number;
  retryAdmitted: boolean;
  reason: string | null;
}

export function plan(request: Request, config: Config): Plan {
  throw new Unimplemented('plan');
}
