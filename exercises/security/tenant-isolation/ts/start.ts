import { Unimplemented } from '#harness';

export interface Store {
  name: string;
  kind: 'index' | 'checkpointer' | 'history' | 'memory' | 'cache' | 'trace' | 'evalset';
  separation: 'per-tenant' | 'shared';
  engineEnforced: boolean;
  keyDerived: boolean;
  scopedToTransaction: boolean;
  inInventory: boolean;
}

export interface Step {
  store: string;
  tenantId: string | null;
  onResume: boolean;
}

export interface Run {
  tenantId: string;
  steps: Step[];
  resumedOnAnotherMachine: boolean;
}

export interface Policy {
  decisionPoints: number;
  requireEngineEnforcement: string[];
}

export interface Reads {
  store: string;
  allowed: boolean;
  reason: string | null;
}

export interface Report {
  status: 'isolated' | 'leaking';
  findings: string[];
  reads: Reads[];
  uninventoried: string[];
  layers: { separation: number; engine: number; application: number };
}

export function inspect(stores: Store[], run: Run, policy: Policy): Report {
  throw new Unimplemented('inspect');
}
