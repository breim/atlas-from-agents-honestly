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

const backoff = (policy: Policy, attempt: number) =>
  Math.min(policy.initialIntervalMs * policy.backoffCoefficient ** (attempt - 1), policy.maximumIntervalMs);

export function execute(policy: Policy, outcomes: Outcome[]): Execution {
  let elapsedMs = 0;
  let lastError: string | null = null;

  for (let attempts = 1; attempts <= outcomes.length; attempts += 1) {
    const outcome = outcomes[attempts - 1];
    elapsedMs += outcome.durationMs;

    if (outcome.error === null) return { status: 'completed', attempts, elapsedMs, lastError: null };
    lastError = outcome.error;

    // A rejection that will fail identically every time is not worth an attempt.
    if (policy.nonRetryable.includes(lastError)) {
      return { status: 'non_retryable', attempts, elapsedMs, lastError };
    }

    if (policy.maximumAttempts !== 0 && attempts >= policy.maximumAttempts) {
      return { status: 'attempts_exhausted', attempts, elapsedMs, lastError };
    }

    const wait = backoff(policy, attempts);
    if (elapsedMs + wait >= policy.scheduleToCloseMs) {
      return { status: 'deadline_exceeded', attempts, elapsedMs, lastError };
    }
    elapsedMs += wait;
  }

  // Nothing decided it, so it is still going. This is what an unlimited policy looks like.
  return { status: 'retrying', attempts: outcomes.length, elapsedMs, lastError };
}
