import { Unimplemented } from '#harness';

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
  throw new Unimplemented('authorize');
}
