import { Unimplemented } from '#harness';

export interface Round {
  draft: string;
  resolves: string[];
  introduces: string[];
}

export interface Outcome {
  draft: string;
  accepted: string[];
  rejected: string[];
}

export function revise(_draft: string, _rounds: Round[]): Outcome {
  throw new Unimplemented('revise');
}
