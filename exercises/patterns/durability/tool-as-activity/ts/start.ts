import { Unimplemented } from '#harness';

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
  _history: Recorded[],
  _calls: string[],
  _run: (activity: string) => string,
): Replay {
  throw new Unimplemented('replay');
}
