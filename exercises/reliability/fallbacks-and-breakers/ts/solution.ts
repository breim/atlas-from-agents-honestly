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
  const attempted: string[] = [];
  const skipped: Array<{ name: string; why: string }> = [];

  for (const [index, rung] of ladder.entries()) {
    // Failing fast is the whole point of the open state.
    if (request.open.includes(rung.name)) {
      skipped.push({ name: rung.name, why: 'breaker_open' });
      continue;
    }
    // High-stakes work escalates rather than accepting the cheapest rung still answering.
    if (request.tier > rung.maxTier) {
      skipped.push({ name: rung.name, why: 'tier_too_high' });
      continue;
    }

    attempted.push(rung.name);
    const outcome = request.behaviour[rung.name];

    if (outcome === 'ok') {
      return { outcome: 'served', servedBy: rung.name, degraded: index > 0, attempted, skipped, error: null };
    }

    // Only a transient failure falls through. A refusal is not a capacity problem.
    if (outcome !== 'transient') {
      return { outcome: 'halted', servedBy: null, degraded: false, attempted, skipped, error: outcome };
    }
  }

  return { outcome: 'escalate', servedBy: null, degraded: false, attempted, skipped, error: 'no_capacity' };
}
