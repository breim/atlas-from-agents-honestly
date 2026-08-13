export interface Watch {
  tripped: boolean;
  at: number | null;
  worstBps: number | null;
}

export function watch(outcomes: string[], window: number, floorBps: number): Watch {
  let worstBps: number | null = null;

  for (let end = window - 1; end < outcomes.length; end += 1) {
    const slice = outcomes.slice(end - window + 1, end + 1);
    const bps = (slice.filter((outcome) => outcome === 'ok').length * 10000) / window;

    worstBps = worstBps === null ? bps : Math.min(worstBps, bps);
    if (bps < floorBps) return { tripped: true, at: end, worstBps };
  }

  return { tripped: false, at: null, worstBps };
}
