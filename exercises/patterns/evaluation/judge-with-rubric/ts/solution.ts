export interface Criterion {
  criterion: string;
  weight: number;
  min: number;
}

export interface Verdict {
  total: number;
  verdict: 'pass' | 'fail';
  unaddressed: string[];
  vetoed: string[];
}

export function judge(
  scores: Record<string, number>,
  rubric: Criterion[],
  threshold: number,
): Verdict {
  const unaddressed: string[] = [];
  const vetoed: string[] = [];
  let weighted = 0;
  let weights = 0;

  for (const entry of rubric) {
    // An unscored criterion is a zero, not an exclusion from the denominator.
    if (!Object.hasOwn(scores, entry.criterion)) unaddressed.push(entry.criterion);

    const score = scores[entry.criterion] ?? 0;
    if (score < entry.min) vetoed.push(entry.criterion);

    weighted += score * entry.weight;
    weights += entry.weight;
  }

  const total = weights === 0 ? 0 : Math.floor(weighted / weights + 0.5);
  const passed = total >= threshold && vetoed.length === 0;

  return { total, verdict: passed ? 'pass' : 'fail', unaddressed, vetoed };
}
