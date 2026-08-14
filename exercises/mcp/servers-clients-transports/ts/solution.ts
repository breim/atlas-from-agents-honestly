export interface Token {
  subject: string;
  audience: string;
  scopes: string[];
  expiresAt: number;
}

export interface Request {
  resource: string;
  scope: string;
  argumentSubject?: string;
}

export type Authorized =
  | { ok: true; subject: string }
  | { ok: false; error: 'expired' | 'wrong_audience' | 'missing_scope' };

export function authorize(token: Token, request: Request, now: number): Authorized {
  if (now >= token.expiresAt) return { ok: false, error: 'expired' };

  // A token whose audience nobody checks is a token another server can replay against you.
  if (token.audience !== request.resource) return { ok: false, error: 'wrong_audience' };

  if (!token.scopes.includes(request.scope)) return { ok: false, error: 'missing_scope' };

  return { ok: true, subject: token.subject };
}
