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

const canonical = (action: Action): string => `${action.tool}|${action.account}|${action.cents}`;

export function gate(action: Action, approval: Approval | null, now: number): Verdict {
  if (approval === null) return { allowed: false, reason: 'approval_required' };
  if (approval.hash !== canonical(action)) return { allowed: false, reason: 'action_mismatch' };
  if (now >= approval.expiresAt) return { allowed: false, reason: 'approval_expired' };

  return { allowed: true, reason: null };
}
