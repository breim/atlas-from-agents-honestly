export interface Write {
  key: string;
  value: string;
}

/** `Map.set` on an existing key updates in place and keeps its insertion position. */
export function render(writes: Write[]): string {
  const pad = new Map<string, string>();
  for (const { key, value } of writes) pad.set(key, value);

  return [...pad].map(([key, value]) => `${key}=${value}`).join('\n');
}
