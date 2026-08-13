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

export function retry(failures: number, policy: Policy): Retry {
  const full = [
    ...Array.from({ length: policy.fastAttempts }, (_, i) => (i === 0 ? 0 : policy.fastMs)),
    ...Array.from({ length: policy.slowAttempts }, () => policy.slowMs),
  ];

  const attempts = Math.min(failures + 1, full.length);

  return { schedule: full.slice(0, attempts), attempts, gaveUp: failures >= full.length };
}
