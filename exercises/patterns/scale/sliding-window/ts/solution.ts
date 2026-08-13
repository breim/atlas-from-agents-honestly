export interface Event {
  id: string;
  at: number;
}

export function window(events: Event[], now: number, windowMs: number): string[] {
  const edge = now - windowMs;
  return events.filter((event) => event.at >= edge).map((event) => event.id);
}
