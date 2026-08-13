import { Unimplemented } from '#harness';

export interface Policy {
  fastAttempts: number;
  fastMs: number;
  slowAttempts: number;
  slowMs: number;
}

export interface Retry {
  schedule: number[];
  attempts: number;
  gaveUp: boolean;
}

export function retry(_failures: number, _policy: Policy): Retry {
  throw new Unimplemented('retry');
}
