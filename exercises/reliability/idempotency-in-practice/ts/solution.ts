export interface Row {
  key: string;
  state: 'IN_FLIGHT' | 'DONE' | 'FAILED';
  leaseUntilMs: number;
  failedBefore?: boolean;
  result?: string;
}

export interface Store {
  rows: Record<string, Row>;
  windowMs: number;
  durable: boolean;
  transactional: boolean;
}

export interface Attempt {
  key: string;
  atMs: number;
  worker: string;
  outcome: 'ok' | 'timeout' | 'rejected-before-effect';
  effect: string;
  slowestCallMs: number;
  runAliveUntilMs: number;
  external: boolean;
}

export interface Config {
  leaseMs: number;
  approvalPauseMs: number;
}

export interface Outcome {
  status: 'applied' | 'deduplicated' | 'waited' | 'retried' | 'escalated' | 'unsound';
  errors: string[];
  alerts: string[];
  effects: number;
  store: Store;
  outbox: string[];
}

export function attempt(request: Attempt, store: Store, config: Config): Outcome {
  const errors: string[] = [];
  const alerts: string[] = [];

  // The record must be more durable than whatever would repeat the call.
  if (!store.durable) errors.push('the dedup record is less durable than the thing that would repeat the call');
  // A marker in one store and the write in another reintroduces the crash gap.
  if (!store.transactional) errors.push('the effect and the record do not commit together');
  // The window must exceed the longest interval over which the same call could be attempted.
  if (store.windowMs < config.approvalPauseMs) {
    errors.push(`a ${store.windowMs}ms window is shorter than a ${config.approvalPauseMs}ms approval pause`);
  }
  // Expiring the lease early causes the exact duplicate it prevents.
  if (config.leaseMs < request.slowestCallMs) {
    errors.push(`a ${config.leaseMs}ms lease is shorter than the slowest legitimate call`);
  }

  if (errors.length > 0) {
    return { status: 'unsound', errors, alerts, effects: 0, store, outbox: [] };
  }

  const rows = { ...store.rows };
  const existing = rows[request.key];
  const outbox: string[] = [];
  const land = (state: Row['state'], extra: Partial<Row> = {}) => {
    rows[request.key] = { key: request.key, state, leaseUntilMs: request.atMs + config.leaseMs, ...extra };
  };

  if (existing) {
    if (existing.state === 'DONE') {
      return { status: 'deduplicated', errors, alerts, effects: 0, store: { ...store, rows }, outbox };
    }
    // The IN_FLIGHT row is what makes a concurrent duplicate wait instead of double-executing.
    if (existing.state === 'IN_FLIGHT' && request.atMs < existing.leaseUntilMs) {
      return { status: 'waited', errors, alerts, effects: 0, store: { ...store, rows }, outbox };
    }
    // A FAILED row is retryable only when the failure was provably before the effect.
    if (existing.state === 'FAILED' && existing.failedBefore !== true) {
      return { status: 'escalated', errors, alerts: [...alerts, `${request.key} failed after the effect may have landed`], effects: 0, store: { ...store, rows }, outbox };
    }
  }

  // Alert when a key expires while its run is still alive.
  if (existing && request.atMs - (existing.leaseUntilMs - config.leaseMs) > store.windowMs && request.runAliveUntilMs > request.atMs) {
    alerts.push(`${request.key} expired while its run was still alive`);
  }

  if (request.outcome === 'rejected-before-effect') {
    land('FAILED', { failedBefore: true });
    return { status: 'retried', errors, alerts, effects: 0, store: { ...store, rows }, outbox };
  }

  if (request.outcome === 'timeout') {
    land('FAILED', { failedBefore: false });
    return { status: 'escalated', errors, alerts, effects: 1, store: { ...store, rows }, outbox };
  }

  // An external effect cannot join the transaction, so commit the intent with the record.
  if (request.external) {
    land('IN_FLIGHT');
    outbox.push(`${request.key}:${request.effect}`);
    return { status: 'applied', errors, alerts, effects: 0, store: { ...store, rows }, outbox };
  }

  land('DONE', { result: request.effect });
  return { status: 'applied', errors, alerts, effects: 1, store: { ...store, rows }, outbox };
}
