export interface Rung {
  model: string;
  cost: number;
}

export interface Cascade {
  answeredBy: string;
  tried: string[];
  spent: number;
  escalated: boolean;
}

export function cascade(ladder: Rung[], confidences: number[], threshold: number): Cascade {
  const tried: string[] = [];
  let spent = 0;

  for (const [index, rung] of ladder.entries()) {
    tried.push(rung.model);
    spent += rung.cost;

    const last = index === ladder.length - 1;
    if (confidences[index] >= threshold || last) {
      return { answeredBy: rung.model, tried, spent, escalated: tried.length > 1 };
    }
  }

  throw new Error('an empty ladder cannot answer');
}
