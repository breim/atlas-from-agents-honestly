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
  // Every gate answers three questions. Fewer than three is an undefined state.
  const errors: string[] = [];
  if (spec.onSilence === null) errors.push(`${spec.id} does not say what happens if nobody responds`);
  if (spec.backup === null) errors.push(`${spec.id} names no backup`);
  if (spec.expiresAfterMs === null) errors.push(`${spec.id} never expires`);
  // Fail closed: silence is denial, never approval.
  if (spec.onSilence === 'approve') errors.push(`${spec.id} approves on silence, which fails open`);

  if (errors.length > 0) {
    return { status: 'undefined-gate', errors, outcome: 'none', queued: false, record: null };
  }

  const answered = event.kind === 'answered';
  const outcome: 'approved' | 'denied' = answered && event.answer === 'approve' ? 'approved' : 'denied';

  // A timeout denial and a judgement denial are different events; say which.
  const denialKind =
    outcome === 'approved' ? null : event.kind === 'timeout' ? 'timeout' : answered ? 'judgement' : 'fault';

  const record: Record_ = {
    gate: spec.id,
    outcome,
    denialKind,
    reviewer: event.reviewer ?? spec.backup,
    reasoning: event.reasoning ?? `no reviewer response: ${event.kind}`,
    // The rendered card as bytes. Re-rendering later produces a different card.
    card: event.card ?? '',
    control: event.control ?? 'hard',
    // Retention is a decision, and keeping everything forever is a liability.
    retentionDays: Math.min(policy.retentionDays, policy.maxRetentionDays),
  };

  if (record.card === '') errors.push(`${spec.id} recorded no rendered card, so nothing proves what was shown`);

  return {
    status: 'recorded',
    errors,
    outcome,
    // Auto-deny is not the end of the case. It routes to a human, or it is a silent failure.
    queued: outcome === 'denied' && denialKind !== 'judgement',
    record,
  };
}
