import { Unimplemented } from '#harness';

export interface Call {
  at: number;
  outcome: 'ok' | 'fail';
}

export interface Breaker {
  states: Array<'closed' | 'open' | 'half-open'>;
  reached: number[];
}

export function run(_calls: Call[], _threshold: number, _cooldownMs: number): Breaker {
  throw new Unimplemented('run');
}
