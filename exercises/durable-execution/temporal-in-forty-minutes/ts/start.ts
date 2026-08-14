import { Unimplemented } from '#harness';

export interface Step {
  name: string;
  kind: 'workflow' | 'activity';
  uses?: 'clock' | 'random' | 'db-read' | null;
}

export interface Event {
  type: 'activity-completed';
  step: number;
  name: string;
  value: string;
}

export interface World {
  results: Record<string, Array<{ status: 'ok' | 'fail'; value?: string }>>;
}

export interface Retry {
  maximumAttempts: number;
  initialIntervalMs: number;
  backoffCoefficient: number;
}

export interface Config {
  retry: Retry;
  nondeterministic: string[];
}

export interface Run {
  status: 'completed' | 'failed' | 'nondeterministic';
  error: string | null;
  executed: string[];
  replayed: string[];
  attempts: Array<{ name: string; count: number; backoffMs: number[] }>;
  history: Event[];
  result: string | null;
}

export function run(program: Step[], history: Event[], world: World, config: Config): Run {
  throw new Unimplemented('run');
}
