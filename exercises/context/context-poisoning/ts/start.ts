import { Unimplemented } from '#harness';

export interface Candidate {
  key: string;
  value: string;
  sources: string[];
}

export interface Admission {
  admitted: boolean;
  reason: string | null;
}

export function admit(
  _candidate: Candidate,
  _pinned: Record<string, string>,
  _trusted: string[],
): Admission {
  throw new Unimplemented('admit');
}
