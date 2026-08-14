import { Unimplemented } from '#harness';

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
  throw new Unimplemented('record');
}
