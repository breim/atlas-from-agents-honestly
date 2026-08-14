import { Unimplemented } from '#harness';

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

export function plan(steps: Step[], config: Config): Plan {
  throw new Unimplemented('plan');
}
