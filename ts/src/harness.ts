import { readFileSync } from 'node:fs';

/**
 * An exercise ships two implementations of the same exports: `start.ts`, which
 * the reader edits, and `solution.ts`, the reference. The same test file grades
 * both, so a solution that drifts from its own exercise fails CI rather than
 * quietly diverging.
 */
export async function loadImpl<T = Record<string, unknown>>(testUrl: string): Promise<T> {
  const file = process.env.ATLAS_SOLUTIONS ? 'solution.ts' : 'start.ts';
  return import(new URL(file, testUrl).href) as Promise<T>;
}

/** The observable contract, shared byte-for-byte with the Python track. */
export function expected<T = { chapter: string; cases: Array<{ id: string }> }>(testUrl: string): T {
  return JSON.parse(readFileSync(new URL('../expected.json', testUrl), 'utf8'));
}

export function findCase<T extends { id: string }>(fixture: { chapter: string; cases: T[] }, id: string): T {
  const found = fixture.cases.find((entry) => entry.id === id);
  if (!found) throw new Error(`no case ${JSON.stringify(id)} in ${fixture.chapter}`);
  return found;
}

/** `Unimplemented` is what a `start.ts` throws, and what "not done yet" looks like in a report. */
export class Unimplemented extends Error {
  constructor(what: string) {
    super(`${what} is not implemented yet`);
  }
}
