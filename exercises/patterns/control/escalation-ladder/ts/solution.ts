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

export function escalate(kind: string, ladder: Rung[], outcomes: string[]): Escalation {
  const capable = ladder.filter((rung) => rung.handles.includes(kind));
  const result: Escalation = { path: [], resolved: false, cost: 0 };

  for (const [attempt, rung] of capable.entries()) {
    result.path.push(rung.rung);
    result.cost += rung.cost;

    if (outcomes[attempt] === 'ok') {
      result.resolved = true;
      return result;
    }
  }

  return result;
}
