export interface Tool {
  name: string;
  reversibility: 'reversible' | 'irreversible' | 'external';
  compensation: string | null;
}

export interface Step {
  tool: string;
  outcome: 'ok' | 'transient' | 'rejected';
}

export interface Config {
  pivot: string;
  maxAttempts: number;
}

export interface Applied {
  tool: string;
  attempts: number;
}

export interface Undone {
  step: string;
  compensation: string;
  status: 'compensated' | 'failed' | 'none';
}

export interface Saga {
  status: 'completed' | 'unwound' | 'forward-only' | 'invalid';
  errors: string[];
  applied: Applied[];
  unwound: Undone[];
  incidents: string[];
}

export function run(plan: Step[], catalogue: Tool[], world: Record<string, string>, config: Config): Saga {
  const byName = new Map(catalogue.map((tool) => [tool.name, tool]));
  const errors: string[] = [];

  // A write without a declared compensation cannot participate, and that is checkable.
  for (const step of plan) {
    const tool = byName.get(step.tool);
    if (!tool) {
      errors.push(`${step.tool} is not in the catalogue`);
      continue;
    }
    if (tool.reversibility === 'reversible' && !tool.compensation) {
      errors.push(`${tool.name} is reversible but declares no compensation`);
    }
  }

  // Order by reversibility: everything fallible before the pivot, everything irreversible after.
  const pivotAt = plan.findIndex((step) => step.tool === config.pivot);
  if (pivotAt >= 0) {
    plan.slice(0, pivotAt).forEach((step, index) => {
      const tool = byName.get(step.tool);
      if (tool && tool.reversibility !== 'reversible') {
        errors.push(`${tool.name} is ${tool.reversibility} and sits at ${index}, before the pivot`);
      }
    });
  }

  if (errors.length > 0) {
    return { status: 'invalid', errors, applied: [], unwound: [], incidents: [] };
  }

  const applied: Applied[] = [];
  let failedAt = -1;

  for (const [index, step] of plan.entries()) {
    let attempts = 0;
    let ok = false;
    while (attempts < config.maxAttempts) {
      attempts += 1;
      // A business rejection is not transient. Retrying it burns the budget and changes nothing.
      if (step.outcome === 'rejected') break;
      if (step.outcome === 'ok' || attempts === config.maxAttempts) {
        ok = step.outcome === 'ok';
        break;
      }
    }
    applied.push({ tool: step.tool, attempts });
    if (!ok) {
      failedAt = index;
      break;
    }
  }

  if (failedAt === -1) {
    return { status: 'completed', errors: [], applied, unwound: [], incidents: [] };
  }

  // Past the pivot, the correct response to failure is to finish, not to reverse.
  if (pivotAt >= 0 && failedAt > pivotAt) {
    return { status: 'forward-only', errors: [], applied, unwound: [], incidents: [] };
  }

  // Unwind in reverse, only what actually succeeded.
  const unwound: Undone[] = [];
  const incidents: string[] = [];
  for (const step of plan.slice(0, failedAt).reverse()) {
    const tool = byName.get(step.tool) as Tool;
    if (!tool.compensation) {
      unwound.push({ step: tool.name, compensation: '', status: 'none' });
      incidents.push(`${tool.name} ran and cannot be reversed`);
      continue;
    }
    const outcome = world[tool.compensation] ?? 'ok';
    if (outcome === 'ok') {
      unwound.push({ step: tool.name, compensation: tool.compensation, status: 'compensated' });
      continue;
    }
    // One failed compensation raises an incident and does not stop the others.
    unwound.push({ step: tool.name, compensation: tool.compensation, status: 'failed' });
    incidents.push(`${tool.compensation} failed; a human owns ${tool.name}`);
  }

  return { status: 'unwound', errors: [], applied, unwound, incidents };
}
