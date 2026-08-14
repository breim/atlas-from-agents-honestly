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
  const owners = config.ownership[request.failureClass] ?? [];

  // Every layer that does not own this class gets one attempt, not zero: one attempt
  // is the call itself. Two owners is not defence in depth, it is multiplication.
  const layers = config.layers.map((layer) => ({
    name: layer.name,
    attempts: owners.includes(layer.name) ? layer.attempts : 1,
  }));

  // The fourth layer is not in the config and multiplies anyway.
  const totalCalls = layers.reduce((product, layer) => product * layer.attempts, 1) * request.modelRetries;

  // The run owns the deadline; the call gets a share of what is left, never all of it.
  const share = Math.floor((request.remainingMs * config.reserveBps) / 10000);
  const timeoutMs = request.remainingMs <= 0 ? 0 : Math.min(request.preferredTimeoutMs, share);

  const usedBps =
    request.callsInWindow === 0
      ? 0
      : Math.floor((request.retriesInWindow * 10000) / request.callsInWindow + 0.5);

  const reason =
    owners.length === 0
      ? 'not_retryable'
      : request.remainingMs <= 0
        ? 'deadline_exceeded'
        : request.attemptsUsed >= config.maxAttemptsPerRun
          ? 'run_attempts_exhausted'
          : usedBps >= config.retryBudgetBps
            ? 'retry_budget_exhausted'
            : null;

  return {
    layers,
    totalCalls,
    multiplied: owners.length > 1,
    timeoutMs,
    retryAdmitted: reason === null,
    reason,
  };
}
