import { Unimplemented } from '#harness';

export interface Chunk {
  id: string;
  parentId: string | null;
  text: string;
}

export function expand(
  _hits: string[],
  _chunks: Chunk[],
  _parents: Record<string, string>,
): string[] {
  throw new Unimplemented('expand');
}
