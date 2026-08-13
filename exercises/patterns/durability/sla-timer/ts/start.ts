import { Unimplemented } from '#harness';

export interface TimerEvent {
  kind: 'extend' | 'resolve';
  at: number;
  to?: number;
}

export interface Fired {
  fired: boolean;
  at: number | null;
}

export function runTimer(_deadline: number, _events: TimerEvent[], _horizon: number): Fired {
  throw new Unimplemented('runTimer');
}
