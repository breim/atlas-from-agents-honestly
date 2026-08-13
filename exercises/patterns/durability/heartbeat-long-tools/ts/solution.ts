export interface Liveness {
  alive: boolean;
  declaredDeadAt: number | null;
}

export function monitor(
  startedAt: number,
  beats: number[],
  finishedAt: number,
  timeout: number,
): Liveness {
  let previous = startedAt;

  for (const beat of [...beats, finishedAt]) {
    if (beat - previous > timeout) return { alive: false, declaredDeadAt: previous + timeout };
    previous = beat;
  }

  return { alive: true, declaredDeadAt: null };
}
