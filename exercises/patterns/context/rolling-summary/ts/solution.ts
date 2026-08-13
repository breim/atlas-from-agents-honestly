export interface State {
  summary: string[];
  recent: string[];
}

export function append(state: State, turnId: string, keepRecent: number): State {
  const recent = [...state.recent, turnId];
  const overflow = Math.max(0, recent.length - keepRecent);

  return {
    summary: [...state.summary, ...recent.slice(0, overflow)],
    recent: recent.slice(overflow),
  };
}
