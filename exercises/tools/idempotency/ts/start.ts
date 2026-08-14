import { Unimplemented } from '#harness';

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

export function canonical(args: Record<string, string | number>): string {
  throw new Unimplemented('canonical');
}

export function idempotencyKey(
  runId: string,
  tool: string,
  args: Record<string, string | number>,
  length: number,
): string {
  throw new Unimplemented('idempotencyKey');
}

export function dispatch(attempts: Attempt[], ledger: Ledger, config: Config): Run {
  throw new Unimplemented('dispatch');
}
