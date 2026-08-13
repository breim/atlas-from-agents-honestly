export interface RunState {
  generation: number;
  summary: string[];
  recent: string[];
  events: number;
}

export function run(events: string[], maxEvents: number, keepRecent: number): RunState {
  const state: RunState = { generation: 0, summary: [], recent: [], events: 0 };

  for (const event of events) {
    state.recent.push(event);
    while (state.recent.length > keepRecent) state.summary.push(state.recent.shift()!);

    state.events += 1;
    if (state.events >= maxEvents) {
      state.generation += 1;
      state.events = 0;
    }
  }

  return state;
}
