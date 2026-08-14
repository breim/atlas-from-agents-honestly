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

const superviseViolations = (plan: Plan): string[] => {
  const violations: string[] = [];
  const inputs = plan.agents.map((agent) => agent.input);
  if (new Set(inputs).size !== inputs.length) violations.push('overlapping_inputs');
  // A worker talking to a worker is a handoff bought inside a supervisor.
  if (plan.agents.some((agent) => agent.next !== null)) violations.push('workers_talked');
  // A verifier given conclusions is a second vote, not a check.
  if (plan.verifiesAgainst !== 'sources') violations.push('verified_against_conclusions');
  return violations;
};

export function execute(plan: Plan, budget: Budget): Executed {
  const byName = new Map(plan.agents.map((agent) => [agent.name, agent]));
  const steps: Executed['steps'] = [];

  if (plan.topology === 'supervisor') {
    // Every worker reads a source directly, so nothing is compressed on the way in.
    for (const agent of plan.agents) {
      if (steps.length >= budget.maxSteps) {
        return { steps, outcome: 'budget_exhausted', terminatedBy: 'budget', violations: superviseViolations(plan) };
      }
      steps.push({ agent: agent.name, compressionDepth: 1 });
    }
    if (steps.length >= budget.maxSteps) {
      return { steps, outcome: 'budget_exhausted', terminatedBy: 'budget', violations: superviseViolations(plan) };
    }
    steps.push({ agent: 'synthesize', compressionDepth: plan.verifiesAgainst === 'sources' ? 1 : 2 });
    return { steps, outcome: 'completed', terminatedBy: 'supervisor', violations: superviseViolations(plan) };
  }

  // Nobody owns termination unless somebody declares it.
  const violations = plan.agents.some((agent) => agent.declaresDone) ? [] : ['no_termination_owner'];

  let current = plan.start;
  while (steps.length < budget.maxSteps) {
    const agent = byName.get(current)!;
    // Each transfer is another compression of what the previous agent kept.
    steps.push({ agent: agent.name, compressionDepth: steps.length + 1 });
    if (agent.declaresDone) return { steps, outcome: 'completed', terminatedBy: agent.name, violations };
    // Nowhere to hand it and nobody claiming it: the seam where a ticket is dropped.
    if (agent.next === null) return { steps, outcome: 'dropped', terminatedBy: 'nobody', violations };
    current = agent.next;
  }

  return { steps, outcome: 'budget_exhausted', terminatedBy: 'budget', violations };
}
