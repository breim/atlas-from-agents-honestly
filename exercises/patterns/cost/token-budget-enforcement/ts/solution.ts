export interface Call {
  id: string;
  tokens: number;
}

export interface Enforcement {
  executed: string[];
  refused: string[];
  spent: number;
}

export function enforce(calls: Call[], budget: number): Enforcement {
  const result: Enforcement = { executed: [], refused: [], spent: 0 };

  for (const call of calls) {
    if (result.spent + call.tokens > budget) {
      result.refused.push(call.id);
      continue;
    }

    result.spent += call.tokens;
    result.executed.push(call.id);
  }

  return result;
}
