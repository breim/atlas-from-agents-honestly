export interface Drain {
  processed: string[];
  quarantined: string[];
  attempts: number;
}

export function drain(
  queue: string[],
  process: (item: string) => boolean,
  threshold: number,
): Drain {
  const result: Drain = { processed: [], quarantined: [], attempts: 0 };

  for (const item of queue) {
    let tries = 0;
    let ok = false;

    while (tries < threshold && !ok) {
      tries += 1;
      result.attempts += 1;
      ok = process(item);
    }

    (ok ? result.processed : result.quarantined).push(item);
  }

  return result;
}
