import { Unimplemented } from '#harness';

export interface Policy {
  initialIntervalMs: number;
  backoffCoefficient: number;
  maximumIntervalMs: number;
  maximumAttempts: number;
  scheduleToCloseMs: number;
  nonRetryable: string[];
}

export interface Outcome {
  durationMs: number;
  error: string | null;
}

export interface Execution {
  status: 'completed' | 'non_retryable' | 'attempts_exhausted' | 'deadline_exceeded' | 'retrying';
  attempts: number;
  elapsedMs: number;
  lastError: string | null;
}

export function execute(policy: Policy, outcomes: Outcome[]): Execution {
  throw new Unimplemented('execute');
}
