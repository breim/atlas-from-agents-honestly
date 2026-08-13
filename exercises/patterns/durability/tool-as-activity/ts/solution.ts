export interface Recorded {
  activity: string;
  result: string;
}

export interface Replay {
  results: string[];
  history: Recorded[];
  invocations: number;
  error?: string;
}

export function replay(
  history: Recorded[],
  calls: string[],
  run: (activity: string) => string,
): Replay {
  const recorded = [...history];
  const results: string[] = [];
  let invocations = 0;

  for (const [index, activity] of calls.entries()) {
    const entry = recorded[index];

    if (entry === undefined) {
      const result = run(activity);
      invocations += 1;
      recorded.push({ activity, result });
      results.push(result);
      continue;
    }

    if (entry.activity !== activity) {
      return {
        results: [],
        history,
        invocations: 0,
        error: `non_determinism: expected ${entry.activity}, got ${activity}`,
      };
    }

    results.push(entry.result);
  }

  return { results, history: recorded, invocations };
}
