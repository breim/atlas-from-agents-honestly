import { Unimplemented } from '#harness';

export interface Failure {
  id: string;
  code: string;
  instruction: string | null;
  retryAfterMs: number | null;
}

export interface Entry {
  class: 'transient' | 'permanent' | 'policy' | 'budget' | 'semantic';
  blame: 'world' | 'you' | 'model' | 'person' | 'limit' | 'nobody';
}

export interface Routed extends Entry {
  id: string;
  retryable: boolean;
  escalates: boolean;
  modelFacing: string | null;
  retryAfterMs: number | null;
}

export interface Routing {
  routed: Routed[];
  retried: string[];
  escalated: string[];
  shownToModel: string[];
  countedInErrorRate: string[];
}

export function route(failures: Failure[], catalogue: Record<string, Entry>): Routing {
  throw new Unimplemented('route');
}
