export interface Span {
  id: string;
  kind: 'model' | 'tool' | 'retrieval' | 'decision';
  fields: Record<string, string | number | boolean>;
  payloadBytes: number;
  contentHash: string | null;
}

export interface Run {
  correlationId: string | null;
  outcome: 'answered' | 'escalated' | 'error' | 'blocked';
  spans: Span[];
  latencyMs: number;
}

export interface Policy {
  questions: string[];
  alwaysKeep: string[];
  sampleBps: number;
  outlierLatencyMs: number;
  maxBackendBytes: number;
}

export interface Trace {
  status: 'answerable' | 'incomplete';
  unanswered: string[];
  sampled: boolean;
  keptBecause: string;
  backendBytes: number;
  payloadBytes: number;
  warnings: string[];
}

export function record(run: Run, policy: Policy, drawBps: number): Trace {
  const present = new Set<string>();
  for (const span of run.spans) for (const field of Object.keys(span.fields)) present.add(field);

  // Eight questions a trace must answer alone.
  const unanswered = policy.questions.filter((question) => !present.has(question));

  const warnings: string[] = [];

  // Without a truncation flag, a cut field and an ignored field look identical.
  for (const span of run.spans) {
    if (span.fields.resultTruncated === true && span.fields.truncatedAtBytes === undefined) {
      warnings.push(`${span.id} says it truncated without saying where`);
    }
  }

  // The business entity is the correlation ID, so everything joins without a mapping table.
  if (!run.correlationId) warnings.push('the run carries no correlation id, so nothing joins to it');

  // Metadata and a hash to the backend; full payloads to cheap storage.
  for (const span of run.spans) {
    if (span.payloadBytes > 0 && span.contentHash === null) {
      warnings.push(`${span.id} stores a payload with no hash, so nothing joins or verifies it`);
    }
  }

  const payloadBytes = run.spans.reduce((total, span) => total + span.payloadBytes, 0);
  const backendBytes = run.spans.length * 200;
  if (backendBytes > policy.maxBackendBytes) {
    warnings.push(`the backend holds ${backendBytes} bytes against a budget of ${policy.maxBackendBytes}`);
  }

  // Sample the boring and keep the interesting.
  const interesting = policy.alwaysKeep.includes(run.outcome);
  const slow = run.latencyMs > policy.outlierLatencyMs;
  const keptBecause = interesting ? run.outcome : slow ? 'outlier' : drawBps < policy.sampleBps ? 'sampled' : 'dropped';

  return {
    status: unanswered.length > 0 ? 'incomplete' : 'answerable',
    unanswered,
    sampled: keptBecause !== 'dropped',
    keptBecause,
    backendBytes,
    payloadBytes,
    warnings,
  };
}
