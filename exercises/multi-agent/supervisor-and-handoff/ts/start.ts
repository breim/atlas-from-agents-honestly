import { Unimplemented } from '#harness';

export interface Agent {
  name: string;
  input: string;
  declaresDone: boolean;
  next: string | null;
}

export interface Plan {
  topology: 'supervisor' | 'handoff';
  start: string;
  verifiesAgainst: 'sources' | 'conclusions';
  agents: Agent[];
}

export interface Budget {
  maxSteps: number;
}

export interface Executed {
  steps: Array<{ agent: string; compressionDepth: number }>;
  outcome: 'completed' | 'budget_exhausted' | 'dropped';
  terminatedBy: string;
  violations: string[];
}

export function execute(plan: Plan, budget: Budget): Executed {
  throw new Unimplemented('execute');
}
