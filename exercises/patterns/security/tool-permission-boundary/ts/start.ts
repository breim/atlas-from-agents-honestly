import { Unimplemented } from '#harness';

export interface Verdict {
  allowed: boolean;
  reason: string | null;
}

export function check(
  _tool: string,
  _trust: string,
  _grants: string[],
  _tools: Record<string, string>,
): Verdict {
  throw new Unimplemented('check');
}
