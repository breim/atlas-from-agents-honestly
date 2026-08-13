import { Unimplemented } from '#harness';

export interface Request {
  id: string;
  deadline: number | null;
}

export interface Routing {
  batch: string[];
  sync: string[];
}

export function route(_requests: Request[], _now: number, _batchLatencyMs: number): Routing {
  throw new Unimplemented('route');
}
