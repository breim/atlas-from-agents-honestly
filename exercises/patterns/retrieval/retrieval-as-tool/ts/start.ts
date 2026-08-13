import { Unimplemented } from '#harness';

export type Result =
  | { ok: true; hits: string[] }
  | { ok: false; error: string; message: string };

export function dispatch(
  _args: Record<string, unknown>,
  _corpus: Record<string, string[]>,
  _maxTopK: number,
): Result {
  throw new Unimplemented('dispatch');
}
