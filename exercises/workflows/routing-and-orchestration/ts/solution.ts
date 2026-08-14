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
  kind: string,
  handlers: Handler[],
  outcomes: Record<string, string>,
): Orchestration {
  const capable = handlers.filter((handler) => handler.handles.includes(kind));
  if (capable.length === 0) {
    return { status: 'unroutable', answeredBy: null, dispatched: [], failedBy: null };
  }

  const dispatched: string[] = [];
  for (const handler of capable) {
    dispatched.push(handler.name);
    const outcome = outcomes[handler.name];

    if (outcome === 'ok') {
      return { status: 'answered', answeredBy: handler.name, dispatched, failedBy: null };
    }
    // An error is a fault, not a routing signal: it stops rather than hands on.
    if (outcome === 'error') {
      return { status: 'failed', answeredBy: null, dispatched, failedBy: handler.name };
    }
  }

  return { status: 'unhandled', answeredBy: null, dispatched, failedBy: null };
}
