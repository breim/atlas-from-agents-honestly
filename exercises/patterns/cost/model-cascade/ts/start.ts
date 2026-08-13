import { Unimplemented } from '#harness';

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

export function cascade(_ladder: Rung[], _confidences: number[], _threshold: number): Cascade {
  throw new Unimplemented('cascade');
}
