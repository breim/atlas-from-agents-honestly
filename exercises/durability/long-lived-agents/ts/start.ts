import { Unimplemented } from '#harness';

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
  throw new Unimplemented('live');
}
