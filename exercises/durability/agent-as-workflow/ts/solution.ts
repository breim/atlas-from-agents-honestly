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
  const errors: string[] = [];

  for (const step of plan) {
    // A model call cannot be replayed, so it is an activity. Everything follows from that.
    if (step.kind === 'workflow' && step.effect !== 'decision' && step.effect !== 'clock') {
      errors.push(`${step.name} is a ${step.effect} in workflow code; that is an activity`);
    }
    // The deadline cannot read the clock. It is a run timeout the server enforces.
    if (step.effect === 'clock') {
      errors.push(`${step.name} reads the clock; use the workflow run timeout instead`);
    }
    // An activity's return value is journalled forever, so project inside the activity.
    if (step.kind === 'activity' && (step.payloadBytes ?? 0) > config.maxPayloadBytes) {
      errors.push(`${step.name} returns ${step.payloadBytes} bytes; truncate inside the activity`);
    }
  }

  const activities = plan
    .filter((step) => step.kind === 'activity')
    .map((step) => ({
      name: step.name,
      // The workflow id is stable by construction, so the key is trivially correct.
      idempotencyKey: `${workflowId}:${step.name}`,
      // A slow activity that does not heartbeat is declared timed out and retried while
      // still running, and you pay for both.
      doubleBilled:
        step.effect === 'model' && !step.heartbeats && (step.durationMs ?? 0) > config.activityTimeoutMs,
    }));

  for (const activity of activities) {
    if (activity.doubleBilled) errors.push(`${activity.name} does not heartbeat and will be billed twice`);
  }

  const historyBytes = plan
    .filter((step) => step.kind === 'activity')
    .reduce((total, step) => total + (step.payloadBytes ?? 0), 0);
  if (historyBytes > config.maxHistoryBytes) {
    errors.push(`the history reaches ${historyBytes} bytes; hold a reference and keep messages outside`);
  }

  return {
    status: errors.length > 0 ? 'rejected' : 'completed',
    errors,
    historyBytes,
    activities,
    bounds: {
      steps: 'yours',
      cost: 'yours',
      // Two of Part II's bounds stay yours; the deadline moves to the platform.
      deadline: 'platform',
    },
  };
}
