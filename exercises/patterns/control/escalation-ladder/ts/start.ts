import { Unimplemented } from '#harness';

export interface Rung {
  rung: string;
  handles: string[];
  cost: number;
}

export interface Escalation {
  path: string[];
  resolved: boolean;
  cost: number;
}

export function escalate(_kind: string, _ladder: Rung[], _outcomes: string[]): Escalation {
  throw new Unimplemented('escalate');
}
