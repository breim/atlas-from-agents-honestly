import { Unimplemented } from '#harness';

export interface Serving {
  model: string;
  effort: string;
}

export interface Recording {
  serving: Serving;
  events: Array<{ prompt: string; response: string }>;
}

export interface Config {
  serving: Serving;
  thresholdBps: number;
}

export interface Replayed {
  status: 'replayed' | 'stale' | 'diverged' | 'exhausted';
  responses: string[];
  consumed: number;
  driftBps: number[];
}

export function replay(recording: Recording, requests: string[], config: Config): Replayed {
  throw new Unimplemented('replay');
}
