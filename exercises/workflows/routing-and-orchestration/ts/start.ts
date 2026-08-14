import { Unimplemented } from '#harness';

export interface Handler {
  name: string;
  handles: string[];
}

export interface Orchestration {
  status: 'answered' | 'unhandled' | 'unroutable' | 'failed';
  answeredBy: string | null;
  dispatched: string[];
  failedBy: string | null;
}

export function orchestrate(
  _kind: string,
  _handlers: Handler[],
  _outcomes: Record<string, string>,
): Orchestration {
  throw new Unimplemented('orchestrate');
}
