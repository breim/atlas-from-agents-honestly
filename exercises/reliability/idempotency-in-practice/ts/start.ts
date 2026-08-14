import { Unimplemented } from '#harness';

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
  throw new Unimplemented('attempt');
}
