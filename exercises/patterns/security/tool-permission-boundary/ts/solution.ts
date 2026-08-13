export interface Verdict {
  allowed: boolean;
  reason: string | null;
}

export function check(
  tool: string,
  trust: string,
  grants: string[],
  tools: Record<string, string>,
): Verdict {
  if (!grants.includes(tool)) return { allowed: false, reason: 'not_granted' };
  if (tools[tool] === 'write' && trust === 'external') {
    return { allowed: false, reason: 'taint_ceiling' };
  }

  return { allowed: true, reason: null };
}
