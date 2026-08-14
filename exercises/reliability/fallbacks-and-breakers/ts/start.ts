import { Unimplemented } from '#harness';

export interface Rung {
  name: string;
  maxTier: number;
}

export interface Request {
  tier: number;
  open: string[];
  behaviour: Record<string, 'ok' | 'transient' | 'policy' | 'permanent'>;
}

export interface Served {
  outcome: 'served' | 'halted' | 'escalate';
  servedBy: string | null;
  degraded: boolean;
  attempted: string[];
  skipped: Array<{ name: string; why: string }>;
  error: string | null;
}

export function serve(request: Request, ladder: Rung[]): Served {
  throw new Unimplemented('serve');
}
