import { Unimplemented } from '#harness';

export interface Grant {
  tool: string;
  usedInLast90Days: boolean;
  argumentScopes: string[];
  maxPerCall: number | null;
  maxPerRun: number | null;
  unattended: boolean;
  appearedAfterAudit: boolean;
}

export interface Call {
  tool: string;
  entity: string;
  amountCents: number;
}

export interface Run {
  id: string;
  entitiesInScope: string[];
  calls: Call[];
  attended: boolean;
  credential: 'standing' | 'run-scoped';
}

export interface Policy {
  requiredScopes: string[];
  mode: 'shadow' | 'enforce';
}

export interface Decision {
  call: number;
  tool: string;
  allowed: boolean;
  reason: string | null;
}

export interface Audit {
  status: 'clean' | 'findings';
  findings: string[];
  decisions: Decision[];
  blocked: number;
  escalated: number;
  spentCents: number;
}

export function govern(grants: Grant[], run: Run, policy: Policy): Audit {
  throw new Unimplemented('govern');
}
