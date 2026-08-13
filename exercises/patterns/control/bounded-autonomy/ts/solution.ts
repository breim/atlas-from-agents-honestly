export interface Action {
  tool: string;
  cents: number;
}

export interface Budget {
  actions: number;
  cents: number;
  tools: string[];
}

export interface Enforcement {
  allowed: string[];
  denied: Array<{ tool: string; reason: string }>;
}

function refuse(action: Action, budget: Budget, taken: number, spent: number): string | null {
  if (!budget.tools.includes(action.tool)) return 'tool_not_granted';
  if (taken >= budget.actions) return 'action_budget_exhausted';
  if (spent + action.cents > budget.cents) return 'spend_budget_exhausted';
  return null;
}

export function enforce(actions: Action[], budget: Budget): Enforcement {
  const result: Enforcement = { allowed: [], denied: [] };
  let taken = 0;
  let spent = 0;

  for (const action of actions) {
    const reason = refuse(action, budget, taken, spent);
    if (reason) {
      result.denied.push({ tool: action.tool, reason });
      continue;
    }

    taken += 1;
    spent += action.cents;
    result.allowed.push(action.tool);
  }

  return result;
}
