export type State = Record<string, unknown>;

export interface Update {
  channel: string;
  value: unknown;
}

export interface Reduced {
  state: State;
  rejected: string[];
}

export function reduce(
  state: State,
  updates: Update[],
  schema: Record<string, string>,
): Reduced {
  const next: State = { ...state };
  const rejected: string[] = [];

  for (const update of updates) {
    const reducer = schema[update.channel];
    if (reducer === undefined) {
      rejected.push(update.channel);
      continue;
    }

    if (reducer === 'append') {
      next[update.channel] = [...(next[update.channel] as unknown[]), update.value];
    } else if (reducer === 'max') {
      next[update.channel] = Math.max(next[update.channel] as number, update.value as number);
    } else {
      next[update.channel] = update.value;
    }
  }

  return { state: next, rejected };
}
