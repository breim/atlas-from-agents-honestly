export interface Outcome {
  status: 'ok' | 'failed' | 'exhausted';
  attempts: number;
  lastError: string | null;
}

const RETRYABLE = ['rate_limit', 'server_error', 'overloaded'];

export function call(attempt: () => string, maxAttempts: number): Outcome {
  let lastError: string | null = null;

  for (let attempts = 1; attempts <= maxAttempts; attempts += 1) {
    const outcome = attempt();
    if (outcome === 'ok') return { status: 'ok', attempts, lastError: null };

    lastError = outcome;
    if (!RETRYABLE.includes(outcome)) return { status: 'failed', attempts, lastError };
  }

  return { status: 'exhausted', attempts: maxAttempts, lastError };
}
