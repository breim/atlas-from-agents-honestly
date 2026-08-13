export interface Rail {
  when: string;
  answer: string;
}

export interface Request {
  intent?: string;
}

export interface Handled {
  answer: string;
  source: 'rail' | 'model';
  modelCalls: number;
}

export function handle(
  request: Request,
  rails: Rail[],
  model: (request: Request) => string,
): Handled {
  const rail = rails.find((candidate) => candidate.when === request.intent);
  if (rail) return { answer: rail.answer, source: 'rail', modelCalls: 0 };

  return { answer: model(request), source: 'model', modelCalls: 1 };
}
