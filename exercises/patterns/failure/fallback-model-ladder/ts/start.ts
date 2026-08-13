import { Unimplemented } from '#harness';

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

export function ask(_ladder: Rung[], _outcomes: string[]): Answer {
  throw new Unimplemented('ask');
}
