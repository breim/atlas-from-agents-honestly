import { Unimplemented } from '#harness';

export interface SagaResult {
  ok: boolean;
  completed: string[];
  compensated: string[];
}

export function runSaga(_steps: string[], _failAt: string | null): SagaResult {
  throw new Unimplemented('runSaga');
}
