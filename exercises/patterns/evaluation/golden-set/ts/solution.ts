export interface GoldenCase {
  id: string;
  expected: string;
}

export interface Score {
  passed: string[];
  failed: string[];
  missing: string[];
  rate: number;
}

export function score(golden: GoldenCase[], answers: Record<string, string>): Score {
  const result: Score = { passed: [], failed: [], missing: [], rate: 0 };

  for (const entry of golden) {
    if (!Object.hasOwn(answers, entry.id)) result.missing.push(entry.id);

    const correct = answers[entry.id] === entry.expected;
    (correct ? result.passed : result.failed).push(entry.id);
  }

  result.rate =
    golden.length === 0 ? 1 : Math.floor((result.passed.length / golden.length) * 10000 + 0.5) / 10000;

  return result;
}
