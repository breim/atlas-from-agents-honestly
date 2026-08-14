export interface Recall {
  recallBps: number;
  missed: string[];
  extra: string[];
}

export function measure(exact: string[], approximate: string[]): Recall {
  const found = new Set(approximate);
  const wanted = new Set(exact);

  const missed = exact.filter((id) => !found.has(id));
  const extra = approximate.filter((id) => !wanted.has(id));

  const recallBps =
    exact.length === 0
      ? 10000
      : Math.floor(((exact.length - missed.length) * 10000) / exact.length + 0.5);

  return { recallBps, missed, extra };
}
