import { Unimplemented } from '#harness';

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
  _scores: Record<string, number>,
  _rubric: Criterion[],
  _threshold: number,
): Verdict {
  throw new Unimplemented('judge');
}
