import { Unimplemented } from '#harness';

export interface Stage {
  name: string;
  cost: number;
}

export interface Pipeline {
  settledBy: string;
  ran: string[];
  spent: number;
}

export function run(_stages: Stage[], _execute: (stage: string) => string): Pipeline {
  throw new Unimplemented('run');
}
