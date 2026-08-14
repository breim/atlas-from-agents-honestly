export interface Argument {
  name: string;
  kind: 'identifier' | 'filter' | 'amount';
}

export interface Tool {
  name: string;
  class: number;
  idempotent?: boolean;
  ceiling?: number;
  arguments: Argument[];
}

export interface Call {
  id: string;
  name: string;
  input: Record<string, string | number>;
  fails?: string;
}

export interface Policy {
  readPrefixes: string[];
}

export interface Outcome {
  id: string;
  name: string;
  class: number;
  status: 'ok' | 'error';
  reason: string | null;
  parallel: boolean;
  retriable: boolean;
  cacheable: boolean;
}

export interface Dispatch {
  order: string[];
  results: Outcome[];
  skipped: string[];
  mislabelled: string[];
}

export function dispatch(calls: Call[], catalogue: Tool[], policy: Policy): Dispatch {
  const byName = new Map(catalogue.map((tool) => [tool.name, tool]));

  // The class is a property of the handler, not of the name.
  const mislabelled = catalogue
    .filter((tool) => tool.class >= 2 && policy.readPrefixes.some((prefix) => tool.name.startsWith(prefix)))
    .map((tool) => tool.name);

  const classOf = (call: Call) => byName.get(call.name)?.class ?? 0;

  const judge = (call: Call): Outcome => {
    const tool = byName.get(call.name);
    const rank = tool?.class ?? 0;
    const base = {
      id: call.id,
      name: call.name,
      class: rank,
      parallel: rank >= 1 && rank <= 2,
      // Free for a pure read, wrong for an observed read, available for a write only if declared.
      retriable: rank === 1 ? true : rank <= 2 ? false : tool?.idempotent === true,
      cacheable: rank === 1,
    };
    const fail = (reason: string): Outcome => ({ ...base, status: 'error', reason });

    if (!tool) return fail(`no tool named ${call.name}`);

    if (rank >= 3) {
      // A filter is a program, and one that matches more rows than the author pictured is the
      // entire incident category.
      const filter = tool.arguments.find((argument) => argument.kind === 'filter');
      if (filter) return fail(`a write takes identifiers, never a filter: ${filter.name}`);

      // The ceiling lives here, next to the entitlement check, not in the schema.
      for (const argument of tool.arguments) {
        if (argument.kind !== 'amount' || tool.ceiling === undefined) continue;
        const value = call.input[argument.name] as number;
        if (value > tool.ceiling) return fail(`${argument.name} ${value} exceeds the ceiling of ${tool.ceiling}`);
      }
    }

    if (call.fails) return fail(call.fails);
    return { ...base, status: 'ok', reason: null };
  };

  const order: string[] = [];
  const results: Outcome[] = [];
  const skipped: string[] = [];

  // Reads concurrently, and every result comes back.
  for (const call of calls.filter((item) => classOf(item) <= 2)) {
    order.push(call.id);
    results.push(judge(call));
  }

  // Writes one at a time, stopping at the first failure.
  let stopped = false;
  for (const call of calls.filter((item) => classOf(item) >= 3)) {
    if (stopped) {
      skipped.push(call.id);
      continue;
    }
    order.push(call.id);
    const outcome = judge(call);
    results.push(outcome);
    if (outcome.status === 'error') stopped = true;
  }

  return { order, results, skipped, mislabelled };
}
