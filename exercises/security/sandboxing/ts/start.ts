import { Unimplemented } from '#harness';

export interface Request {
  kind: 'op' | 'egress' | 'secret';
  op?: string;
  orderId?: string;
  amountCents?: number;
  host?: string;
  name?: string;
  outputBytes: number;
}

export interface Policy {
  egressAllow: string[];
  maxOutputBytes: number;
  catalogue: Record<string, { class: number }>;
}

export interface Scope {
  maxClass: number;
  orderId: string;
  capCents: number;
}

export interface Result {
  allowed: boolean;
  reason: string | null;
  alerted: boolean;
  deliveredBytes: number;
  truncated: boolean;
}

export function handle(request: Request, scope: Scope, policy: Policy): Result {
  throw new Unimplemented('handle');
}
