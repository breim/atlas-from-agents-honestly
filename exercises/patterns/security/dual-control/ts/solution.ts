export interface Signed {
  by: string;
  action: string;
}

export interface Authorisation {
  authorised: boolean;
  reason: string | null;
  approvers: string[];
}

export function authorise(
  request: Signed,
  approvals: Signed[],
  required: number,
): Authorisation {
  const approvers: string[] = [];
  let selfApproval = false;
  let duplicate = false;

  for (const approval of approvals) {
    if (approval.action !== request.action) continue;
    if (approval.by === request.by) {
      selfApproval = true;
      continue;
    }
    if (approvers.includes(approval.by)) {
      duplicate = true;
      continue;
    }
    approvers.push(approval.by);
  }

  if (approvers.length >= required) return { authorised: true, reason: null, approvers };

  const reason = selfApproval
    ? 'self_approval'
    : duplicate
      ? 'duplicate_approver'
      : 'insufficient_approvals';

  return { authorised: false, reason, approvers };
}
