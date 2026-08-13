import { Unimplemented } from '#harness';

export interface Action {
  tool: string;
  account: string;
  cents: number;
}

export interface Approval {
  hash: string;
  expiresAt: number;
}

export interface Verdict {
  allowed: boolean;
  reason: string | null;
}

export function gate(_action: Action, _approval: Approval | null, _now: number): Verdict {
  throw new Unimplemented('gate');
}
