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
  const errors: string[] = [];
  const backend = backends.find((item) => item.name === action.backend);

  // The token must name both principals: whose rights apply, and who is exercising them.
  if (token.model === 'service') errors.push('a service credential makes the agent a confused deputy');
  if (token.model === 'impersonation') errors.push('impersonation gets authorization right and destroys accountability');
  if (token.model === 'delegation' && !token.sub) errors.push('the delegation names no user whose rights apply');
  if (token.model === 'delegation' && !token.act) errors.push('the delegation names no agent exercising them');

  if (!backend) {
    errors.push(`${action.backend} is not a backend`);
  } else {
    // Downscope on the way in. Filtering after a privileged read is a display preference.
    if (backend.filtersOnRead) {
      errors.push(`${backend.name} filters after reading, so the content was still read and logged`);
    }
    const missing = backend.requiredScopes.filter((scope) => !token.scopes.includes(scope));
    for (const scope of missing) errors.push(`the token lacks ${scope} for ${backend.name}`);
    const extra = token.scopes.filter((scope) => !backend.requiredScopes.includes(scope));
    for (const scope of extra) errors.push(`the token carries ${scope}, which ${backend.name} does not need`);
  }

  // Store the delegation reference in the run state, never the token.
  if (action.storedToken) errors.push('the run stored a token rather than a delegation reference');
  if (!action.delegationRef) errors.push('the run holds no delegation reference to re-derive from');

  // Re-derive at the moment of the action: a resumed run replaying old rights is a revocation
  // that silently did not happen.
  if (action.atMs >= token.expiresAtMs) errors.push('the delegation expired before the action');

  // A scheduled agent with no user still needs a named human owner.
  if (action.scheduled && !action.ownerHuman) errors.push('a scheduled run names no human owner');

  const log: Log = {
    user: token.sub,
    agent: token.act ?? agentId,
    run: action.runId,
  };
  // Any two of the three leave "why was this allowed" unanswerable.
  for (const [field, value] of Object.entries(log)) {
    if (!value) errors.push(`the audit line names no ${field}`);
  }

  return {
    status: errors.length > 0 ? 'refused' : 'allowed',
    errors,
    log,
    scopesUsed: errors.length > 0 ? [] : [...token.scopes].sort(),
  };
}
