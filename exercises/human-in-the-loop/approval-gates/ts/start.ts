import { Unimplemented } from '#harness';

export interface Gate {
  position: 'plan' | 'execution' | 'output' | 'exception';
  sideEffects: string[];
  disclose: string[];
  answers: string[];
  expiresAfterMs: number;
  lane: 'fast' | 'deliberate';
}

export interface Decision {
  answer: string;
  atMs: number;
  reason?: string;
  edit?: string;
}

export interface Policy {
  required: string[];
  laneBudgetMs: Record<string, number>;
  volatilityMs: number;
}

export interface Verdict {
  status: 'accepted' | 'rejected' | 'invalid';
  errors: string[];
  next: 'act' | 'revise' | 'halt' | 'none';
  applied: string | null;
  staleBy: number;
}

export function gate(
  spec: Gate,
  decision: Decision,
  presentedAtMs: number,
  policy: Policy,
): Verdict {
  throw new Unimplemented('gate');
}
