export interface Event {
  at: number;
  kind: 'message' | 'timer' | 'close';
  bytes: number;
  text?: string;
}

export interface Config {
  quietWindowMs: number;
  historyEventCap: number;
  historyByteCap: number;
  headroomEvents: number;
  deadlineAt: number;
  carry: 'transcript' | 'summary' | 'reference';
}

export interface Batch {
  actedAt: number;
  events: number[];
}

export interface Recycle {
  at: number;
  eventsBefore: number;
  carried: string;
  drained: number;
}

export interface Life {
  status: 'open' | 'closed' | 'expired';
  batches: Batch[];
  recycles: Recycle[];
  historyEvents: number;
  historyBytes: number;
  warnings: string[];
}

export function live(events: Event[], config: Config, codeVersion: string): Life {
  const batches: Batch[] = [];
  const recycles: Recycle[] = [];
  const warnings: string[] = [];

  let buffer: Event[] = [];
  let historyEvents = 0;
  let historyBytes = 0;
  let status: Life['status'] = 'open';

  // Each new event restarts the quiet window; the batch fires when it finally elapses.
  const flush = (at: number) => {
    if (buffer.length === 0) return;
    batches.push({ actedAt: at, events: buffer.map((event) => event.at) });
    buffer = [];
  };

  for (const [index, event] of events.entries()) {
    // Timers must be absolute: an entity workflow that sleeps a relative span never expires.
    if (event.at >= config.deadlineAt) {
      flush(event.at);
      status = 'expired';
      break;
    }

    historyEvents += 1;
    historyBytes += event.bytes;

    if (event.kind === 'close') {
      flush(event.at);
      status = 'closed';
      break;
    }

    if (event.kind === 'message') {
      // People type in bursts. Acting on each event separately produces contradictory replies.
      buffer.push(event);
      const next = events[index + 1];
      const quiet = !next || next.at - event.at >= config.quietWindowMs;
      if (quiet) flush(event.at + config.quietWindowMs);
    }

    // Recycle with headroom: draining generates events, so waiting for the ceiling is fatal.
    if (historyEvents >= config.historyEventCap - config.headroomEvents || historyBytes >= config.historyByteCap) {
      const drained = buffer.length;
      flush(event.at);
      recycles.push({ at: event.at, eventsBefore: historyEvents, carried: config.carry, drained });
      if (config.carry === 'transcript') {
        warnings.push(`carrying the raw transcript across continue-as-new at ${event.at}`);
      }
      historyEvents = 0;
      historyBytes = 0;
    }
  }

  if (status === 'open') {
    flush(events.length > 0 ? (events.at(-1) as Event).at + config.quietWindowMs : 0);
  }

  if (status === 'open' && events.length > 0) {
    warnings.push(`still open on ${codeVersion}; an entity workflow needs a defined end`);
  }

  return { status, batches, recycles, historyEvents, historyBytes, warnings };
}
