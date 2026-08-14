export interface Request {
  verb: 'start' | 'signal' | 'query' | 'reconnect' | 'list';
  method: 'GET' | 'POST';
  businessId: string | null;
  workflowIdFromBrowser: string | null;
  principal: string | null;
  holdsRequestOpen: boolean;
  credentialsInStream: boolean;
  polling: boolean;
}

export interface Entitlements {
  entitled: Record<string, string[]>;
}

export interface Policy {
  readModelVerbs: string[];
  streamVerbs: string[];
}

export interface Response {
  status: 200 | 202 | 404 | 405 | 500;
  errors: string[];
  workflowId: string | null;
  source: 'workflow' | 'read-model' | 'stream' | null;
  order: string[];
}

export function serve(request: Request, entitlements: Entitlements, policy: Policy): Response {
  const errors: string[] = [];

  // The API layer must not proxy identifiers from the browser.
  if (request.workflowIdFromBrowser) errors.push('the browser supplied a workflow id, which it may not');
  // It must not hold the request open, nor start work on GET.
  if (request.holdsRequestOpen) errors.push('the request was held open instead of returning');
  if (request.method === 'GET' && request.verb === 'start') errors.push('work was started on a GET');
  // Credentials never travel in a buffered stream.
  if (request.credentialsInStream) errors.push('credentials were put into a buffered stream');
  // Polling load scales with open tabs and peaks during the incident.
  if (request.polling && request.verb === 'query') errors.push('a query was polled; stream instead');

  if (errors.length > 0) {
    return { status: 500, errors, workflowId: null, source: null, order: [] };
  }

  if (!request.principal || !request.businessId) {
    // Return 404 rather than 403, or you have confirmed the record exists.
    return { status: 404, errors: ['not found'], workflowId: null, source: null, order: [] };
  }

  const allowed = entitlements.entitled[request.principal] ?? [];
  if (!allowed.includes(request.businessId)) {
    return { status: 404, errors: ['not found'], workflowId: null, source: null, order: [] };
  }

  // The browser sends the business identity; the API derives the workflow id.
  const workflowId = `atlas-${request.businessId}`;

  if (request.verb === 'start') {
    return { status: 202, errors: [], workflowId, source: 'workflow', order: ['start'] };
  }
  if (request.verb === 'signal') {
    return { status: 202, errors: [], workflowId, source: 'workflow', order: ['signal'] };
  }
  if (policy.readModelVerbs.includes(request.verb)) {
    // The read model backs the list; a stale row there is cosmetic.
    return { status: 200, errors: [], workflowId: null, source: 'read-model', order: ['read-model'] };
  }
  if (request.verb === 'reconnect') {
    // Stream-first: open the stream, snapshot, render, reconcile buffered events by id.
    return {
      status: 200,
      errors: [],
      workflowId,
      source: 'stream',
      order: ['open-stream', 'snapshot', 'render', 'reconcile'],
    };
  }
  // A query backs the detail view, once, on cold load.
  return { status: 200, errors: [], workflowId, source: 'workflow', order: ['query'] };
}
