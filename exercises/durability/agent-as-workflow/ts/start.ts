import { Unimplemented } from '#harness';

export interface Placement {
  name: string;
  kind: 'workflow' | 'activity';
  effect: 'model' | 'tool' | 'clock' | 'decision';
  payloadBytes?: number;
  heartbeats?: boolean;
  durationMs?: number;
}

export interface Bounds {
  steps: number;
  costCents: number;
  runTimeoutMs: number;
}

export interface Config {
  maxPayloadBytes: number;
  maxHistoryBytes: number;
  activityTimeoutMs: number;
}

export interface Run {
  status: 'completed' | 'halted' | 'rejected';
  errors: string[];
  historyBytes: number;
  activities: Array<{ name: string; idempotencyKey: string; doubleBilled: boolean }>;
  bounds: { steps: string; cost: string; deadline: string };
}

export function port(plan: Placement[], bounds: Bounds, workflowId: string, config: Config): Run {
  throw new Unimplemented('port');
}
