export interface TimerEvent {
  kind: 'extend' | 'resolve';
  at: number;
  to?: number;
}

export interface Fired {
  fired: boolean;
  at: number | null;
}

export function runTimer(deadline: number, events: TimerEvent[], horizon: number): Fired {
  let current = deadline;

  for (const event of events) {
    if (event.at >= current) return { fired: true, at: current };
    if (event.kind === 'resolve') return { fired: false, at: null };
    current = event.to!;
  }

  return current <= horizon ? { fired: true, at: current } : { fired: false, at: null };
}
