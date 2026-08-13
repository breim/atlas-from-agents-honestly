export interface Entry {
  id: string;
  score: number;
}

export function select(history: Entry[], threshold: number, keepLast: number): string[] {
  const tailStart = Math.max(0, history.length - keepLast);

  return history
    .filter((entry, index) => index >= tailStart || entry.score >= threshold)
    .map((entry) => entry.id);
}
