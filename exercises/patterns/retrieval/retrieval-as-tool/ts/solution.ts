export type Result =
  | { ok: true; hits: string[] }
  | { ok: false; error: string; message: string };

const ACCEPTED = ['query', 'topK'];

export function dispatch(
  args: Record<string, unknown>,
  corpus: Record<string, string[]>,
  maxTopK: number,
): Result {
  const unknown = Object.keys(args).find((key) => !ACCEPTED.includes(key));
  if (unknown !== undefined) {
    return {
      ok: false,
      error: 'unknown_argument',
      message: `unknown argument ${unknown}; accepted arguments are ${ACCEPTED.join(', ')}`,
    };
  }

  const { query, topK } = args;
  if (typeof query !== 'string' || query.trim() === '') {
    return {
      ok: false,
      error: 'missing_argument',
      message: 'query is required and must be a non-empty string',
    };
  }

  if (!Number.isInteger(topK) || (topK as number) < 1 || (topK as number) > maxTopK) {
    return {
      ok: false,
      error: 'out_of_range',
      message: `topK must be an integer between 1 and ${maxTopK}`,
    };
  }

  return { ok: true, hits: (corpus[query] ?? []).slice(0, topK as number) };
}
