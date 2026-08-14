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
  const buffer: Event[] = [];
  const deliveries: Delivery[] = [];
  const watching = new Set<string>();
  let status: Stream['status'] = 'running';
  let unwatchedMinutes = 0;

  for (const action of timeline) {
    if (action.kind === 'emit') {
      if (status === 'running') buffer.push({ id: buffer.length + 1, text: action.text });
      continue;
    }

    if (action.kind === 'connect') {
      // The buffer outlives the run, so a finished run is still readable.
      const since = action.lastEventId ?? 0;
      deliveries.push({
        client: action.client,
        events: buffer.filter((event) => event.id > since).map((event) => event.id),
      });
      watching.add(action.client);
      unwatchedMinutes = 0;
      continue;
    }

    // A dropped connection means nothing knowable, so it ends nothing.
    if (action.kind === 'disconnect') {
      watching.delete(action.client);
      continue;
    }

    if (action.kind === 'stop') {
      if (status === 'running') status = 'cancelled';
      continue;
    }

    if (watching.size > 0 || status !== 'running') continue;
    unwatchedMinutes += action.minutes;
    if (unwatchedMinutes >= abandonAfterMinutes) status = 'abandoned';
  }

  return { status, buffer, deliveries };
}
