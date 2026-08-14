import { Unimplemented } from '#harness';

export interface Argument {
  name: string;
  kind: 'identifier' | 'filter' | 'amount';
}

export interface Tool {
  name: string;
  class: number;
  idempotent?: boolean;
  ceiling?: number;
  arguments: Argument[];
}

export interface Call {
  id: string;
  name: string;
  input: Record<string, string | number>;
  fails?: string;
}

export interface Policy {
  readPrefixes: string[];
}

export interface Outcome {
  id: string;
  name: string;
  class: number;
  status: 'ok' | 'error';
  reason: string | null;
  parallel: boolean;
  retriable: boolean;
  cacheable: boolean;
}

export interface Dispatch {
  order: string[];
  results: Outcome[];
  skipped: string[];
  mislabelled: string[];
}

export function dispatch(calls: Call[], catalogue: Tool[], policy: Policy): Dispatch {
  throw new Unimplemented('dispatch');
}
