import { Unimplemented } from '#harness';

export type Action =
  | { kind: 'emit'; text: string }
  | { kind: 'connect'; client: string; lastEventId: number | null }
  | { kind: 'disconnect'; client: string }
  | { kind: 'stop' }
  | { kind: 'idle'; minutes: number };

export interface Event {
  id: number;
  text: string;
}

export interface Delivery {
  client: string;
  events: number[];
}

export interface Stream {
  status: 'running' | 'cancelled' | 'abandoned';
  buffer: Event[];
  deliveries: Delivery[];
}

export function serve(timeline: Action[], abandonAfterMinutes: number): Stream {
  throw new Unimplemented('serve');
}
