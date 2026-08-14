import { createHash } from 'node:crypto';

export interface Attempt {
  id: string;
  runId: string;
  tool: string;
  args: Record<string, string | number>;
  transport: 'ok' | 'timeout' | 'rejected';
}

export interface Ledger {
  entries: Record<string, { tool: string; runId: string }>;
}

export interface Config {
  reservedArgs: string[];
  keyLength: number;
}

export interface Result {
  id: string;
  key: string | null;
  status: 'applied' | 'unknown' | 'rejected' | 'already-applied' | 'refused';
  note: string | null;
}

export interface Run {
  results: Result[];
  ledger: Ledger;
  effects: number;
}

// Sorted keys and a flat shape: an unstable serialization is an unstable key.
export function canonical(args: Record<string, string | number>): string {
  return Object.keys(args)
    .sort()
    .map((name) => `${name}=${String(args[name])}`)
    .join('&');
}

export function idempotencyKey(runId: string, tool: string, args: Record<string, string | number>, length: number): string {
  return createHash('sha256').update(`${runId}|${tool}|${canonical(args)}`).digest('hex').slice(0, length);
}

export function dispatch(attempts: Attempt[], ledger: Ledger, config: Config): Run {
  const entries = { ...ledger.entries };
  const results: Result[] = [];
  let effects = 0;

  for (const attempt of attempts) {
    // The key comes from your code. Asking the model for one asks it to know it is repeating.
    const reserved = Object.keys(attempt.args).find((name) => config.reservedArgs.includes(name));
    if (reserved) {
      results.push({ id: attempt.id, key: null, status: 'refused', note: `${reserved} is not an argument the model may supply` });
      continue;
    }

    const key = idempotencyKey(attempt.runId, attempt.tool, attempt.args, config.keyLength);

    if (key in entries) {
      // Never silent: the model has to learn that its repeat was already applied.
      results.push({ id: attempt.id, key, status: 'already-applied', note: 'this operation was already applied; nothing changed' });
      continue;
    }

    if (attempt.transport === 'rejected') {
      // Nothing happened, so nothing is recorded and a corrected call may proceed.
      results.push({ id: attempt.id, key, status: 'rejected', note: 'the request was refused before anything happened' });
      continue;
    }

    // A timeout usually happens on the response, so the work landed and the answer was lost.
    entries[key] = { tool: attempt.tool, runId: attempt.runId };
    effects += 1;
    results.push(
      attempt.transport === 'ok'
        ? { id: attempt.id, key, status: 'applied', note: null }
        : { id: attempt.id, key, status: 'unknown', note: 'no response; the operation may or may not have landed' },
    );
  }

  return { results, ledger: { entries }, effects };
}
