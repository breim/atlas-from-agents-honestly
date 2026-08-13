import { Unimplemented } from '#harness';

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

export function score(_golden: GoldenCase[], _answers: Record<string, string>): Score {
  throw new Unimplemented('score');
}
