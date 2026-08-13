import { Unimplemented } from '#harness';

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
  _request: Signed,
  _approvals: Signed[],
  _required: number,
): Authorisation {
  throw new Unimplemented('authorise');
}
