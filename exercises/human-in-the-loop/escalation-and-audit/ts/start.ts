import { Unimplemented } from '#harness';

export interface GateSpec {
  id: string;
  onSilence: 'deny' | 'approve' | null;
  backup: string | null;
  expiresAfterMs: number | null;
}

export interface Event {
  kind: 'answered' | 'timeout' | 'error' | 'missing-payload';
  atMs: number;
  answer?: 'approve' | 'deny';
  reviewer?: string;
  reasoning?: string;
  card?: string;
  control?: 'hard' | 'soft';
}

export interface Policy {
  retentionDays: number;
  maxRetentionDays: number;
}

export interface Record_ {
  gate: string;
  outcome: 'approved' | 'denied';
  denialKind: 'judgement' | 'timeout' | 'fault' | null;
  reviewer: string;
  reasoning: string;
  card: string;
  control: 'hard' | 'soft';
  retentionDays: number;
}

export interface Result {
  status: 'recorded' | 'undefined-gate';
  errors: string[];
  outcome: 'approved' | 'denied' | 'none';
  queued: boolean;
  record: Record_ | null;
}

export function resolve(spec: GateSpec, event: Event, policy: Policy): Result {
  throw new Unimplemented('resolve');
}
