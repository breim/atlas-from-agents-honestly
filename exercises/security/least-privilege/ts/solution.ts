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
  const byTool = new Map(grants.map((grant) => [grant.tool, grant]));
  const findings: string[] = [];

  for (const grant of grants) {
    // An agent chooses at runtime, so every unused grant is now reachable.
    if (!grant.usedInLast90Days) findings.push(`${grant.tool} was not used in ninety days and is still granted`);
    // Most implementations scope only the tool.
    for (const scope of policy.requiredScopes) {
      if (!grant.argumentScopes.includes(scope)) findings.push(`${grant.tool} is not scoped by ${scope}`);
    }
    // Aggregate caps stop the slow attack that per-call caps miss.
    if (grant.maxPerCall !== null && grant.maxPerRun === null) {
      findings.push(`${grant.tool} caps each call and not the run`);
    }
    // A dynamic catalogue invalidates a point-in-time audit.
    if (grant.appearedAfterAudit) findings.push(`${grant.tool} appeared after the audit and is denied by default`);
    // Unattended execution is a permission even though it does not look like one.
    if (grant.unattended && !run.attended) findings.push(`${grant.tool} may run unattended, which the task did not require`);
  }

  // The run id inside the token makes every downstream log answer which run caused what.
  if (run.credential === 'standing') findings.push('the run uses a standing credential rather than a run-scoped one');

  const decisions: Decision[] = [];
  let spentCents = 0;

  run.calls.forEach((call, index) => {
    const grant = byTool.get(call.tool);
    const refuse = (reason: string) => decisions.push({ call: index, tool: call.tool, allowed: false, reason });

    if (!grant) return refuse('no grant for this tool');
    if (grant.appearedAfterAudit) return refuse('appeared after the audit');
    // Bind every write to entities already in scope, taken from your records not the arguments.
    if (!run.entitiesInScope.includes(call.entity)) return refuse(`${call.entity} is not in scope for this run`);
    if (grant.maxPerCall !== null && call.amountCents > grant.maxPerCall) {
      return refuse(`${call.amountCents} exceeds the per-call cap of ${grant.maxPerCall}`);
    }
    if (grant.maxPerRun !== null && spentCents + call.amountCents > grant.maxPerRun) {
      return refuse(`${spentCents + call.amountCents} exceeds the per-run cap of ${grant.maxPerRun}`);
    }
    spentCents += call.amountCents;
    decisions.push({ call: index, tool: call.tool, allowed: true, reason: null });
  });

  const refused = decisions.filter((decision) => !decision.allowed).length;

  return {
    status: findings.length > 0 ? 'findings' : 'clean',
    findings,
    // In shadow mode nothing is actually blocked; you are measuring the policy.
    decisions: policy.mode === 'shadow' ? decisions.map((decision) => ({ ...decision, allowed: true })) : decisions,
    blocked: policy.mode === 'shadow' ? 0 : refused,
    // Denials escalate rather than erroring: a control operators disable is worth less.
    escalated: refused,
    spentCents,
  };
}
