import { Unimplemented } from '#harness';

export interface Token {
  model: 'service' | 'impersonation' | 'delegation';
  sub: string | null;
  act: string | null;
  scopes: string[];
  expiresAtMs: number;
}

export interface Backend {
  name: string;
  requiredScopes: string[];
  filtersOnRead: boolean;
}

export interface Action {
  backend: string;
  atMs: number;
  runId: string;
  delegationRef: string | null;
  storedToken: string | null;
  ownerHuman: string | null;
  scheduled: boolean;
}

export interface Log {
  user: string | null;
  agent: string | null;
  run: string | null;
}

export interface Result {
  status: 'allowed' | 'refused';
  errors: string[];
  log: Log;
  scopesUsed: string[];
}

export function act(token: Token, action: Action, backends: Backend[], agentId: string): Result {
  throw new Unimplemented('act');
}
