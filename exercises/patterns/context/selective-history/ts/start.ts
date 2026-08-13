import { Unimplemented } from '#harness';

export interface Entry {
  id: string;
  score: number;
}

export function select(_history: Entry[], _threshold: number, _keepLast: number): string[] {
  throw new Unimplemented('select');
}
