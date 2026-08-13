import { Unimplemented } from '#harness';

export interface Event {
  id: string;
  at: number;
}

export function window(_events: Event[], _now: number, _windowMs: number): string[] {
  throw new Unimplemented('window');
}
