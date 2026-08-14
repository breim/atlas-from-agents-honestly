import { Unimplemented } from '#harness';

export type Bundle = Record<string, string | number>;

export interface Environment {
  at: number;
  policyVersion: string;
  bundle: Bundle;
}

export interface Run {
  startedAt: number;
  actions: Array<{ name: string; at: number }>;
}

export interface Executed {
  configKey: string;
  actions: Array<{ name: string; at: number; configKey: string; policy: string }>;
}

export function execute(run: Run, environments: Environment[]): Executed {
  throw new Unimplemented('execute');
}
