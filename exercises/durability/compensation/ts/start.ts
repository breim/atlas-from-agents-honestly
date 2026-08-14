import { Unimplemented } from '#harness';

export interface Tool {
  name: string;
  reversibility: 'reversible' | 'irreversible' | 'external';
  compensation: string | null;
}

export interface Step {
  tool: string;
  outcome: 'ok' | 'transient' | 'rejected';
}

export interface Config {
  pivot: string;
  maxAttempts: number;
}

export interface Applied {
  tool: string;
  attempts: number;
}

export interface Undone {
  step: string;
  compensation: string;
  status: 'compensated' | 'failed' | 'none';
}

export interface Saga {
  status: 'completed' | 'unwound' | 'forward-only' | 'invalid';
  errors: string[];
  applied: Applied[];
  unwound: Undone[];
  incidents: string[];
}

export function run(
  plan: Step[],
  catalogue: Tool[],
  world: Record<string, string>,
  config: Config,
): Saga {
  throw new Unimplemented('run');
}
