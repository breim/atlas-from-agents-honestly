export interface Admission {
  admitted: number[];
  rejected: number[];
}

export function admit(
  arrivals: number[],
  capacity: number,
  refillMsPerToken: number,
): Admission {
  const result: Admission = { admitted: [], rejected: [] };
  let tokens = capacity;
  let last: number | null = null;

  for (const at of arrivals) {
    if (last !== null) tokens = Math.min(capacity, tokens + (at - last) / refillMsPerToken);
    last = at;

    if (tokens >= 1) {
      tokens -= 1;
      result.admitted.push(at);
    } else {
      result.rejected.push(at);
    }
  }

  return result;
}
