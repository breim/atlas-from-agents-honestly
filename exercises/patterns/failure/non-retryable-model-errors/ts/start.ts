import { Unimplemented } from '#harness';

export interface Outcome {
  status: 'ok' | 'failed' | 'exhausted';
  attempts: number;
  lastError: string | null;
}

export function call(_attempt: () => string, _maxAttempts: number): Outcome {
  throw new Unimplemented('call');
}
