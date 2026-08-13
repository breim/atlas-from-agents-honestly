import { Unimplemented } from '#harness';

export function rewrite(_query: string, _synonyms: Record<string, string[]>): string {
  throw new Unimplemented('rewrite');
}
