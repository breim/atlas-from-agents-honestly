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
  const byName = new Map(stores.map((store) => [store.name, store]));
  const findings: string[] = [];

  // Securing the index is the part everyone does. The leak comes from the others.
  const uninventoried = stores.filter((store) => !store.inInventory).map((store) => store.name);
  for (const name of uninventoried) findings.push(`${name} is not in the store inventory`);

  for (const store of stores) {
    // A forgotten predicate should return empty results, not everything.
    if (policy.requireEngineEnforcement.includes(store.kind) && !store.engineEnforced) {
      findings.push(`${store.name} leaves the tenant predicate to the application`);
    }
    // Derive keys, don't accept them.
    if (!store.keyDerived) findings.push(`${store.name} accepts its key from the caller`);
    // A pooled connection carrying the previous caller's tenant is load-dependent.
    if (store.separation === 'shared' && !store.scopedToTransaction) {
      findings.push(`${store.name} scopes the tenant outside the transaction`);
    }
  }

  // One decision point or none. Three partial systems have the security of the weakest.
  if (policy.decisionPoints > 1) {
    findings.push(`${policy.decisionPoints} authorization decision points have the security of the weakest`);
  }

  const reads: Reads[] = run.steps.map((step) => {
    const store = byName.get(step.store);
    if (!store) return { store: step.store, allowed: false, reason: 'no such store' };
    // Tenancy must survive pauses and resumption on another machine.
    if (step.tenantId === null) {
      return { store: step.store, allowed: false, reason: 'the step carries no tenant' };
    }
    if (step.tenantId !== run.tenantId) {
      return { store: step.store, allowed: false, reason: `${step.tenantId} is not the run tenant` };
    }
    if (step.onResume && run.resumedOnAnotherMachine && !store.keyDerived) {
      return { store: step.store, allowed: false, reason: 'a resumed step re-used a key it did not derive' };
    }
    return { store: step.store, allowed: true, reason: null };
  });

  return {
    status: findings.length > 0 || reads.some((read) => !read.allowed) ? 'leaking' : 'isolated',
    findings,
    reads,
    uninventoried,
    layers: {
      separation: stores.filter((store) => store.separation === 'per-tenant').length,
      engine: stores.filter((store) => store.engineEnforced).length,
      application: stores.length,
    },
  };
}
