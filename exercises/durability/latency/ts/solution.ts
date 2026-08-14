export interface Step {
  name: string;
  kind: 'model' | 'tool' | 'validation' | 'lookup' | 'format';
  durationMs: number;
  onEntryPath: boolean;
  needsSignals: boolean;
  needsHeartbeat: boolean;
}

export interface Config {
  localBudgetMs: number;
  roundTripMs: number;
}

export type Reason =
  | 'model_call'
  | 'needs_heartbeat'
  | 'must_stay_reachable'
  | 'too_long'
  | 'off_the_entry_path'
  | 'short_and_on_the_entry_path';

export interface Placement {
  name: string;
  mode: 'local' | 'activity';
  reason: Reason;
}

export interface Plan {
  placements: Placement[];
  entryLatencyMs: number;
}

const disqualify = (step: Step, config: Config): Reason | undefined => {
  if (step.kind === 'model') return 'model_call';
  if (step.needsHeartbeat) return 'needs_heartbeat';
  // Nothing external reaches the workflow while a local activity runs.
  if (step.needsSignals) return 'must_stay_reachable';
  if (step.durationMs > config.localBudgetMs) return 'too_long';
  return undefined;
};

export function plan(steps: Step[], config: Config): Plan {
  const placements = steps.map<Placement>((step) => {
    const reason = disqualify(step, config);
    if (reason) return { name: step.name, mode: 'activity', reason };
    // Off the entry path there is a model call ahead to hide the round trip behind.
    if (!step.onEntryPath) return { name: step.name, mode: 'activity', reason: 'off_the_entry_path' };
    return { name: step.name, mode: 'local', reason: 'short_and_on_the_entry_path' };
  });

  const entryLatencyMs = steps.reduce((total, step, index) => {
    if (!step.onEntryPath) return total;
    const trip = placements[index].mode === 'activity' ? config.roundTripMs : 0;
    return total + step.durationMs + trip;
  }, 0);

  return { placements, entryLatencyMs };
}
