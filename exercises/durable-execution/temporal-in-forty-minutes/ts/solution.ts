export interface Step {
  name: string;
  kind: 'workflow' | 'activity';
  uses?: 'clock' | 'random' | 'db-read' | null;
}

export interface Event {
  type: 'activity-completed';
  step: number;
  name: string;
  value: string;
}

export interface World {
  results: Record<string, Array<{ status: 'ok' | 'fail'; value?: string }>>;
}

export interface Retry {
  maximumAttempts: number;
  initialIntervalMs: number;
  backoffCoefficient: number;
}

export interface Config {
  retry: Retry;
  nondeterministic: string[];
}

export interface Run {
  status: 'completed' | 'failed' | 'nondeterministic';
  error: string | null;
  executed: string[];
  replayed: string[];
  attempts: Array<{ name: string; count: number; backoffMs: number[] }>;
  history: Event[];
  result: string | null;
}

export function run(program: Step[], history: Event[], world: World, config: Config): Run {
  const recorded = new Map(history.map((event) => [event.step, event]));
  const pending: Record<string, Array<{ status: 'ok' | 'fail'; value?: string }>> = {};
  for (const [name, list] of Object.entries(world.results)) pending[name] = [...list];

  const executed: string[] = [];
  const replayed: string[] = [];
  const attempts: Array<{ name: string; count: number; backoffMs: number[] }> = [];
  const produced: Event[] = [...history];
  let result: string | null = null;

  const fail = (status: Run['status'], error: string): Run => ({
    status,
    error,
    executed,
    replayed,
    attempts,
    history: produced,
    result: null,
  });

  for (const [index, step] of program.entries()) {
    if (step.kind === 'workflow') {
      // Orchestration is replayed freely, so it may not read anything that can change.
      if (step.uses && config.nondeterministic.includes(step.uses)) {
        return fail('nondeterministic', `${step.name} uses ${step.uses} in workflow code; that is an activity`);
      }
      continue;
    }

    // The unit of memoization is the effect. A completed activity is never run again.
    const already = recorded.get(index);
    if (already) {
      replayed.push(step.name);
      result = already.value;
      continue;
    }

    const outcomes = pending[step.name] ?? [];
    const backoffMs: number[] = [];
    let count = 0;
    let landed: string | null = null;

    while (count < config.retry.maximumAttempts) {
      count += 1;
      const outcome = outcomes.shift() ?? { status: 'fail' as const };
      if (outcome.status === 'ok') {
        landed = outcome.value as string;
        break;
      }
      if (count < config.retry.maximumAttempts) {
        backoffMs.push(config.retry.initialIntervalMs * config.retry.backoffCoefficient ** (count - 1));
      }
    }

    executed.push(step.name);
    attempts.push({ name: step.name, count, backoffMs });

    if (landed === null) {
      return fail('failed', `${step.name} failed after ${count} attempts`);
    }

    produced.push({ type: 'activity-completed', step: index, name: step.name, value: landed });
    result = landed;
  }

  return { status: 'completed', error: null, executed, replayed, attempts, history: produced, result };
}
