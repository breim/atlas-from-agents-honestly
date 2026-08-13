export interface SagaResult {
  ok: boolean;
  completed: string[];
  compensated: string[];
}

export function runSaga(steps: string[], failAt: string | null): SagaResult {
  const completed: string[] = [];

  for (const step of steps) {
    if (step === failAt) {
      return { ok: false, completed, compensated: [...completed].reverse() };
    }
    completed.push(step);
  }

  return { ok: true, completed, compensated: [] };
}
