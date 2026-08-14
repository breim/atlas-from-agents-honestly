export type Value = string | number;

export interface Step {
  name: string;
  result: Value;
}

export interface Run {
  status: 'completed' | 'crashed' | 'non_determinism';
  results: Value[];
  executed: string[];
  journal: Step[];
}

export function run(program: Step[], journal: Step[], crashAfter: number): Run {
  const log = [...journal];
  const results: Value[] = [];
  const executed: string[] = [];

  for (const [index, step] of program.entries()) {
    const recorded = journal[index];

    if (recorded !== undefined) {
      // Replay compares the sequence of effects. A different name at this position means
      // the runtime can no longer tell where in the code this execution is.
      if (recorded.name !== step.name) {
        return { status: 'non_determinism', results: [], executed: [], journal };
      }
      results.push(recorded.result);
      continue;
    }

    if (executed.length >= crashAfter) {
      return { status: 'crashed', results: [], executed, journal: log };
    }

    executed.push(step.name);
    log.push({ name: step.name, result: step.result });
    results.push(step.result);
  }

  return { status: 'completed', results, executed, journal: log };
}
