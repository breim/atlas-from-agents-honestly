export interface Rung {
  model: string;
  cost: number;
}

export interface Answer {
  answeredBy: string | null;
  tried: string[];
  spent: number;
  status: 'ok' | 'refused' | 'exhausted';
}

const INFRASTRUCTURE = ['overloaded', 'server_error'];

export function ask(ladder: Rung[], outcomes: string[]): Answer {
  const tried: string[] = [];
  let spent = 0;

  for (const [index, rung] of ladder.entries()) {
    tried.push(rung.model);
    spent += rung.cost;

    const outcome = outcomes[index];
    if (outcome === 'ok') return { answeredBy: rung.model, tried, spent, status: 'ok' };
    if (!INFRASTRUCTURE.includes(outcome)) {
      return { answeredBy: rung.model, tried, spent, status: 'refused' };
    }
  }

  return { answeredBy: null, tried, spent, status: 'exhausted' };
}
