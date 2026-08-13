export interface Request {
  id: string;
  deadline: number | null;
}

export interface Routing {
  batch: string[];
  sync: string[];
}

const batchable = (request: Request, now: number, latency: number): boolean =>
  request.deadline === null || now + latency <= request.deadline;

export function route(requests: Request[], now: number, batchLatencyMs: number): Routing {
  const routing: Routing = { batch: [], sync: [] };

  for (const request of requests) {
    const lane = batchable(request, now, batchLatencyMs) ? 'batch' : 'sync';
    routing[lane].push(request.id);
  }

  return routing;
}
