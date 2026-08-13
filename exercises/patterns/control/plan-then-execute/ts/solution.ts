export interface Step {
  id: string;
  tool: string;
  needs: string[];
}

export interface Outcome {
  ok: boolean;
  error?: string;
  executed: string[];
}

/** Returns the first problem with the plan, or null when it is safe to run. */
function validate(plan: Step[], tools: string[]): string | null {
  const ids = new Set<string>();
  for (const step of plan) {
    if (ids.has(step.id)) return `duplicate_step: ${step.id}`;
    ids.add(step.id);
  }

  const satisfied = new Set<string>();
  for (const step of plan) {
    if (!tools.includes(step.tool)) return `unknown_tool: ${step.tool}`;
    for (const need of step.needs) {
      if (!ids.has(need)) return `unknown_dependency: ${need}`;
      if (!satisfied.has(need)) return `dependency_not_yet_satisfied: ${need}`;
    }
    satisfied.add(step.id);
  }

  return null;
}

export function run(plan: Step[], tools: string[]): Outcome {
  const error = validate(plan, tools);
  if (error) return { ok: false, error, executed: [] };

  return { ok: true, executed: plan.map((step) => step.id) };
}
