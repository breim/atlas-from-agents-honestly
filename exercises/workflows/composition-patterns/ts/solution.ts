export interface Step {
  id: string;
  ms: number;
  ok: boolean;
}

export type Mode = 'sequential' | 'parallel' | 'fanout';

export interface Composition {
  results: string[];
  failed: string[];
  elapsed: number;
}

const slowest = (steps: Step[]): number => steps.reduce((max, step) => Math.max(max, step.ms), 0);

function elapsedFor(steps: Step[], mode: Mode, limit: number): number {
  if (mode === 'sequential') return steps.reduce((sum, step) => sum + step.ms, 0);
  if (mode === 'parallel') return slowest(steps);

  let total = 0;
  for (let start = 0; start < steps.length; start += limit) {
    total += slowest(steps.slice(start, start + limit));
  }
  return total;
}

export function compose(steps: Step[], mode: Mode, limit: number): Composition {
  return {
    // Declaration order, whatever order the work finished in.
    results: steps.filter((step) => step.ok).map((step) => step.id),
    failed: steps.filter((step) => !step.ok).map((step) => step.id),
    elapsed: elapsedFor(steps, mode, limit),
  };
}
