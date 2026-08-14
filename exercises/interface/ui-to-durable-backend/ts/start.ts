import { Unimplemented } from '#harness';

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
  throw new Unimplemented('serve');
}
