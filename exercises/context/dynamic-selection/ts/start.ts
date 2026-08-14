import { Unimplemented } from '#harness';

export interface Profile {
  tools: string[];
  instructions: string[];
  namespace: string | null;
}

export interface Catalogue {
  systemTokens: number;
  tools: Record<string, number>;
  instructions: Record<string, number>;
}

export interface RunStep {
  category?: string;
  calls: string[];
  additions: string[];
  variableTokens: number;
}

export interface Run {
  category: string;
  steps: RunStep[];
}

export interface Config {
  cacheReadBps: number;
  selectPerRequest: boolean;
}

export interface StepReport {
  step: number;
  prefixTokens: number;
  variableTokens: number;
  cached: boolean;
  billedTokens: number;
  refused: string[];
}

export interface Selection {
  namespace: string | null;
  steps: StepReport[];
  billedTokens: number;
  offered: string[];
  used: string[];
  neverCalled: string[];
  refused: string[];
}

export function select(
  run: Run,
  profiles: Record<string, Profile>,
  catalogue: Catalogue,
  config: Config,
): Selection {
  throw new Unimplemented('select');
}
